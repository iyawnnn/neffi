// Real row-lock races on disposable loopback PostgreSQL. Never loads .env.local or prints credentials/codes.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../src/db/schema";
import { randomCrockford } from "../src/lib/crockford";
import { issueActivationCredential } from "../src/modules/activation/credentials";
import { consumeQuota, hmacHex } from "../src/auth/otp-quota";
import { initiateRecovery, completeRecovery } from "../src/modules/accounts/recovery";
import { submitSupportRequest } from "../src/modules/support/intake";
import type { EmailSender } from "../src/integrations/email/resend";
import { sql } from "drizzle-orm";
import { claimCard } from "../src/modules/activation/claim";
import { connectCardToProfile, setCardDisabled } from "../src/modules/cards/manage";
import { reserveDbcCards } from "../src/modules/orders/fulfillment";
import { loadOrderFacts } from "../src/modules/orders/order";
import { createProfileFromStarter } from "../src/modules/profiles/profiles";
import { openCase, setCaseStatus } from "../src/modules/support/case";
import { afterSaleRefund, voidCompletedPayment, recordCompletedPayment } from "../src/modules/support/money";
import { retireAffectedCard, releaseReplacementCard, reissueActivationCode, resetCardOwnership } from "../src/modules/support/cards";
import type { Db } from "../src/modules/db";

const url = new URL(process.env.DATABASE_URL_TEST ?? "");
assert.equal(url.hostname, "127.0.0.1", "Requires disposable loopback PostgreSQL");
assert.equal(url.port, "55432");
assert.equal(url.pathname, "/neffi_m2_test");
assert(["postgres:", "postgresql:"].includes(url.protocol));
assert(![...url.searchParams.keys()].some((key) => ["host", "hostaddr", "port"].includes(key)));
const clients: pg.Client[] = [], pools: pg.Pool[] = [], failures: string[] = [];
const secret = randomBytes(32).toString("hex");
const errorCode = (error: unknown) => (error as { cause?: { code?: string }; code?: string } | undefined)?.cause?.code ?? (error as { code?: string } | undefined)?.code;
async function connect() {
  const client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  await client.connect();
  await client.query("SET statement_timeout = '15s'");
  clients.push(client);
  return client;
}
function database() {
  const pool = new pg.Pool({ connectionString: url.href, max: 2, options: "-c statement_timeout=15000" });
  pools.push(pool);
  return drizzle({ client: pool, schema, casing: "snake_case" });
}
function settle(promise: Promise<unknown>) {
  const state = { done: false, error: undefined as unknown };
  const finished = promise.then(() => { state.done = true; }, (error: unknown) => { state.done = true; state.error = error; });
  return { state, finished };
}
async function check(label: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${label}`); }
  catch (error) { failures.push(label); console.error(`FAIL ${label}: ${error instanceof assert.AssertionError ? error.message : "database/domain error"}`); }
}

try {
  const admin = await connect();
  assert(!(await admin.query("SELECT current_setting('neon.project_id', true) AS neon")).rows[0].neon, "Never Neon");
  const [dbA, dbB] = [database(), database()];
  await migrate(dbA, { migrationsFolder: "drizzle" });
  const first = (await admin.query("SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
  await migrate(dbA, { migrationsFolder: "drizzle" });
  assert.deepEqual((await admin.query("SELECT id,hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows, first);
  console.log(`PASS migration chain (${first.length}) and no-op rerun`);
  const [owner, purchaser, product, stock, customer] = Array.from({ length: 5 }, () => randomUUID());
  await admin.query("INSERT INTO accounts(id,name,email,role) VALUES($1,'Synthetic support owner',$2,'owner'),($3,'Synthetic customer',$4,'customer')", [owner, `${owner}@example.test`, customer, `${customer}@example.test`]);
  await admin.query("INSERT INTO purchasers(id,name) VALUES($1,'Synthetic support buyer')", [purchaser]);
  await admin.query("INSERT INTO products(id,kind,name,price,active) VALUES($1,'dbc','Synthetic support DBC',100,false)", [product]);
  await admin.query("INSERT INTO stock_purchases(id,received_on,created_by_account_id) VALUES($1,'2026-10-14',$2)", [stock, owner]);

  async function ready() {
    const cardId = randomUUID();
    await admin.query("INSERT INTO cards(id,stock_purchase_id,product_id,kind,public_token) VALUES($1,$2,$3,'dbc',$4)", [cardId, stock, product, randomCrockford(26)]);
    const { credentialId } = await issueActivationCredential(dbA, cardId, secret);
    await admin.query("UPDATE cards SET state='ready',nfc_verified_at=now(),package_matched_at=now() WHERE id=$1", [cardId]);
    return { cardId, credentialId };
  }
  async function fixture(completed = true) {
    const orderId = randomUUID(), orderItemId = randomUUID();
    await admin.query("INSERT INTO orders(id,purchaser_id,created_by_account_id,assigned_to_account_id,delivery_method) VALUES($1,$2,$3,$3,'pickup')", [orderId, purchaser, owner]);
    await admin.query("INSERT INTO order_items(id,order_id,product_id,product_kind,quantity,unit_price) VALUES($1,$2,$3,'dbc',1,100)", [orderItemId, orderId, product]);
    const card = await ready();
    await admin.query("UPDATE cards SET state='released',order_item_id=$2 WHERE id=$1", [card.cardId, orderItemId]);
    if (completed) await admin.query("UPDATE orders SET status='completed',completed_at=now() WHERE id=$1", [orderId]);
    const { caseId } = await openCase(dbA, { actorId: owner, type: "other", summary: "Synthetic correction", orderId, cardId: card.cardId });
    const { rows: [payment] } = await admin.query("INSERT INTO payments(order_id,amount,method,paid_on,recorded_by_account_id) VALUES($1,100,'cash','2026-10-14',$2) RETURNING id", [orderId, owner]);
    return { actorId: owner, caseId, orderId, orderItemId, ...card, paymentId: payment.id as string, reason: "Synthetic verified correction" };
  }
  async function lockedScenario(table: "support_cases" | "orders" | "order_items" | "cards" | "accounts" | "auth_otp_quotas", id: string, calls: (() => Promise<unknown>)[], prepare?: (holder: Db) => Promise<void>, whileBlocked?: (holder: Db) => Promise<void>) {
    const holder = await connect();
    const { rows: [{ pid }] } = await holder.query("SELECT pg_backend_pid() AS pid");
    let pending: ReturnType<typeof settle>[] = [];
    try {
      await drizzle({ client: holder, schema, casing: "snake_case" }).transaction(async (tx) => {
        const key = table === "auth_otp_quotas" ? "key" : "id";
        await holder.query(`SELECT ${key} FROM ${table} WHERE ${key}=$1 FOR ${table === "support_cases" || table === "orders" ? "NO KEY UPDATE" : "UPDATE"}`, [id]);
        if (prepare) await prepare(tx);
        pending = calls.map((call) => settle(call()));
      let waiting = 0;
      for (const deadline = Date.now() + 5000; waiting < calls.length && !pending.some((p) => p.state.done) && Date.now() < deadline;) {
        const { rows: [row] } = await admin.query(`WITH RECURSIVE blocked(pid) AS (
          SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))
          UNION SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid=ANY(pg_blocking_pids(a.pid))
        ) SELECT count(*)::int AS n FROM blocked`, [pid]);
        waiting = row.n;
        if (waiting < calls.length) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(waiting, calls.length, "Every service demonstrates an actual lock wait");
      if (whileBlocked) await whileBlocked(tx);
      });
      await Promise.all(pending.map((p) => p.finished));
      return pending.map((p) => p.state.error);
    } finally {
      await Promise.all(pending.map((p) => p.finished));
    }
  }
  const single = (errors: unknown[], code: string) => { assert.equal(errors.filter((e) => !e).length, 1); assert.equal(errorCode(errors.find(Boolean)), code); };

  await check("R1 competing after-sale refunds stay within cash kept", async () => {
    const f = await fixture();
    single(await lockedScenario("support_cases", f.caseId, [() => afterSaleRefund(dbA, { ...f, amount: 80, method: "cash" }), () => afterSaleRefund(dbB, { ...f, amount: 80, method: "cash" })]), "refund_exceeded");
    assert.equal((await loadOrderFacts(dbA, f.orderId)).totals.netPaid, 20);
  });
  await check("R2 void vs corrected payment uses the current balance", async () => {
    const f = await fixture();
    const errors = await lockedScenario("support_cases", f.caseId, [() => voidCompletedPayment(dbA, f), () => recordCompletedPayment(dbB, { ...f, amount: 100, method: "cash" })]);
    assert(!errors[0]);
    if (errors[1]) assert.equal(errorCode(errors[1]), "balance_exceeded");
    assert.equal((await loadOrderFacts(dbA, f.orderId)).totals.balance, errors[1] ? 100 : 0);
  });
  await check("R3 competing corrected payments cannot overpay", async () => {
    const f = await fixture();
    await voidCompletedPayment(dbA, f);
    single(await lockedScenario("support_cases", f.caseId, [() => recordCompletedPayment(dbA, { ...f, amount: 100, method: "cash" }), () => recordCompletedPayment(dbB, { ...f, amount: 100, method: "cash" })]), "balance_exceeded");
    assert.equal((await loadOrderFacts(dbA, f.orderId)).totals.balance, 0);
  });
  await check("R4 replacement waits for the affected retirement", async () => {
    const f = await fixture();
    const target = await ready();
    // Hold the case with an uncommitted retirement: the replacement must see it only after commit.
    const errors = await lockedScenario("support_cases", f.caseId, [() => releaseReplacementCard(dbB, { ...f, cardId: target.cardId })], async (holder) => {
      await retireAffectedCard(holder, f);
    });
    assert(!errors[0]);
    assert.equal((await admin.query("SELECT state FROM cards WHERE id=$1", [target.cardId])).rows[0].state, "released");
  });
  await check("R5 one retired slot permits only one replacement", async () => {
    const f = await fixture();
    await retireAffectedCard(dbA, f);
    const a = await ready(), b = await ready();
    single(await lockedScenario("support_cases", f.caseId, [() => releaseReplacementCard(dbA, { ...f, cardId: a.cardId }), () => releaseReplacementCard(dbB, { ...f, cardId: b.cardId })]), "replacement_unavailable");
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM support_case_cards WHERE support_case_id=$1 AND role='replacement'", [f.caseId])).rows[0].n, 1);
  });
  await check("R6 replacement vs M8 reservation has one Ready-card winner", async () => {
    const f = await fixture();
    await retireAffectedCard(dbA, f);
    const other = await fixture(false), target = await ready();
    // The other fixture's released card is retired to expose its item capacity.
    await retireAffectedCard(dbA, other);
    single(await lockedScenario("cards", target.cardId, [() => releaseReplacementCard(dbA, { ...f, cardId: target.cardId }), () => reserveDbcCards(dbB, { ...other, cardIds: [target.cardId] })]), "card_unavailable");
  });
  await check("R7 reissue vs old-code claim never leaves reusable history", async () => {
    const f = await fixture();
    const errors = await lockedScenario("cards", f.cardId, [() => reissueActivationCode(dbA, { ...f, verificationNote: "Synthetic purchase verified", activationSecret: secret }), async () => {
      const result = await claimCard(dbB, { credentialId: f.credentialId, accountId: customer });
      if (result.status !== "claimed") throw Object.assign(new Error("unavailable"), { code: "unavailable" });
    }]);
    assert.equal(errors.filter((e) => !e).length, 1);
    assert(["card_claimed", "unavailable"].includes(errorCode(errors.find(Boolean))!));
    const { rows: [row] } = await admin.query("SELECT owner_account_id, (SELECT count(*)::int FROM activation_credentials WHERE card_id=$1 AND used_at IS NULL AND revoked_at IS NULL) AS usable FROM cards WHERE id=$1", [f.cardId]);
    assert.equal(row.usable, row.owner_account_id ? 0 : 1);
  });
  for (const action of ["connect", "disable"] as const) await check(`R8 reset vs customer ${action} cannot reconnect after reset`, async () => {
    const f = await fixture();
    await claimCard(dbA, { credentialId: f.credentialId, accountId: customer });
    const { rows: [profile] } = await admin.query("INSERT INTO profiles(account_id) VALUES($1) RETURNING id", [customer]);
    const errors = await lockedScenario("cards", f.cardId, [() => resetCardOwnership(dbA, { ...f, verificationNote: "Synthetic purchase verified", activationSecret: secret }), () => action === "connect" ? connectCardToProfile(dbB, { accountId: customer, cardId: f.cardId, profileId: profile.id }) : setCardDisabled(dbB, { accountId: customer, cardId: f.cardId, disabled: true })]);
    assert(!errors[0]);
    if (errors[1]) assert.equal(errorCode(errors[1]), "not_found");
    const { rows: [card] } = await admin.query("SELECT owner_account_id,profile_id,disabled_at FROM cards WHERE id=$1", [f.cardId]);
    assert.deepEqual(card, { owner_account_id: null, profile_id: null, disabled_at: null });
    await assert.rejects(connectCardToProfile(dbB, { accountId: customer, cardId: f.cardId, profileId: profile.id }), (e: unknown) => errorCode(e) === "not_found");
  });
  await check("R9 resolve vs correction has one consistent history", async () => {
    const f = await fixture();
    const errors = await lockedScenario("support_cases", f.caseId, [() => setCaseStatus(dbA, { ...f, status: "resolved" }), () => afterSaleRefund(dbB, { ...f, amount: 10, method: "cash" })]);
    assert(!errors[0]);
    if (errors[1]) assert.equal(errorCode(errors[1]), "case_resolved");
    assert.equal((await admin.query("SELECT status FROM support_cases WHERE id=$1", [f.caseId])).rows[0].status, "resolved");
    assert.equal((await loadOrderFacts(dbA, f.orderId)).totals.afterSaleRefunded, errors[1] ? 0 : 10);
  });
  for (const action of ["reset", "retire"] as const) {
    const correct = (tx: Db, f: Awaited<ReturnType<typeof fixture>>) => action === "reset"
      ? resetCardOwnership(tx, { ...f, verificationNote: "Synthetic purchase verified", activationSecret: secret })
      : retireAffectedCard(tx, f);
    for (const first of ["setup", "support"] as const) await check(`R10 setup vs ${action}, ${first} first, has no deadlock`, async () => {
      const f = await fixture();
      const accountId = randomUUID();
      await admin.query("INSERT INTO accounts(id,name,email,role) VALUES($1,'Synthetic setup customer',$2,'customer')", [accountId, `${accountId}@example.test`]);
      await claimCard(dbA, { credentialId: f.credentialId, accountId });
      const setup = (tx: Db) => createProfileFromStarter(tx, { accountId, cardId: f.cardId, purpose: "network", essentials: { fullName: "Synthetic setup", headline: null, bio: null, email: null, phone: null, link: null } });
      let profileId: string | undefined;
      let errors: unknown[];
      try {
        errors = first === "setup"
          ? await lockedScenario("accounts", accountId, [() => correct(dbB, f)], undefined, async (holder) => { profileId = (await setup(holder)).profileId; })
          : await lockedScenario("cards", f.cardId, [() => setup(dbB)], async (holder) => { await correct(holder, f); });
      } catch (error) { assert.fail(`Setup/support must complete without a database error (${errorCode(error)})`); }
      if (first === "setup") assert(!errors[0], `Support must finish after setup (${errorCode(errors[0])})`);
      else assert.equal(errorCode(errors[0]), "not_found");
      const { rows: [card] } = await admin.query("SELECT state,owner_account_id,profile_id,disabled_at FROM cards WHERE id=$1", [f.cardId]);
      assert.deepEqual(card, { state: action === "reset" ? "released" : "retired", owner_account_id: null, profile_id: null, disabled_at: null });
      const profiles = (await admin.query("SELECT id,account_id FROM profiles WHERE account_id=$1", [accountId])).rows;
      assert.equal(profiles.length, first === "setup" ? 1 : 0);
      if (profileId) assert.deepEqual(profiles[0], { id: profileId, account_id: accountId });
      const { rows: [history] } = await admin.query("SELECT used_at,revoked_at FROM activation_credentials WHERE id=$1", [f.credentialId]);
      assert(history.used_at); assert.equal(history.revoked_at, null);
      assert.equal((await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1 AND used_at IS NULL AND revoked_at IS NULL", [f.cardId])).rows[0].n, action === "reset" ? 1 : 0);
      assert.equal((await admin.query("SELECT account_id FROM activity_events WHERE support_case_id=$1 AND type=$2", [f.caseId, action === "reset" ? "card_ownership_reset" : "card_retired"])).rows[0].account_id, accountId);
    });
    await check(`R11 ${action} refuses a changed owner after its Account snapshot`, async () => {
      const f = await fixture();
      await claimCard(dbA, { credentialId: f.credentialId, accountId: customer });
      const other = await openCase(dbA, { actorId: owner, type: "ownership_correction", summary: "Synthetic concurrent reset", cardId: f.cardId });
      const newOwner = randomUUID();
      await admin.query("INSERT INTO accounts(id,name,email,role) VALUES($1,'Synthetic rightful customer',$2,'customer')", [newOwner, `${newOwner}@example.test`]);
      const errors = await lockedScenario("cards", f.cardId, [() => correct(dbB, f)], undefined, async (holder) => {
        const fresh = await resetCardOwnership(holder, { ...f, caseId: other.caseId, verificationNote: "Synthetic purchase verified", activationSecret: secret });
        assert.equal((await claimCard(holder, { accountId: newOwner, credentialId: fresh.credentialId })).status, "claimed");
      });
      assert.equal(errorCode(errors[0]), "card_unavailable");
      assert.deepEqual((await admin.query("SELECT state,owner_account_id FROM cards WHERE id=$1", [f.cardId])).rows[0], { state: "released", owner_account_id: newOwner });
      assert.equal((await admin.query("SELECT count(*)::int AS n FROM activity_events WHERE support_case_id=$1 AND type IN ('card_retired','card_ownership_reset')", [f.caseId])).rows[0].n, 0);
      assert.equal((await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1", [f.cardId])).rows[0].n, 2);
    });
  }
  await check("R12 unclaimed reissue vs retirement completes without a Card/item FK cycle", async () => {
    const f = await fixture();
    const other = await openCase(dbA, { actorId: owner, type: "activation_issue", summary: "Synthetic concurrent reissue", cardId: f.cardId });
    const errors = await lockedScenario("cards", f.cardId, [() => retireAffectedCard(dbB, f)], undefined, async (holder) => {
      await reissueActivationCode(holder, { ...f, caseId: other.caseId, verificationNote: "Synthetic purchase verified", activationSecret: secret });
    });
    assert(!errors[0], `Retirement must finish after reissue (${errorCode(errors[0])})`);
    assert.deepEqual((await admin.query("SELECT state,owner_account_id,profile_id FROM cards WHERE id=$1", [f.cardId])).rows[0], { state: "retired", owner_account_id: null, profile_id: null });
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1 AND used_at IS NULL AND revoked_at IS NULL", [f.cardId])).rows[0].n, 0);
  });
  const noEmail: EmailSender = async () => {};
  async function recoveryTarget() {
    const accountId = randomUUID(), email = `${randomUUID()}@example.test`;
    await admin.query("INSERT INTO accounts(id,name,email,role,email_verified) VALUES($1,'Synthetic recovery customer',$2,'customer',true)", [accountId, email]);
    const { caseId } = await openCase(dbA, { actorId: owner, type: "account_recovery", summary: "Synthetic recovery", accountId });
    return { accountId, email, caseId, actorId: owner, newEmail: `${randomUUID()}@example.test`, secret, confirmed: true, verificationNote: "Synthetic purchase verified", unlinkGoogle: true };
  }
  async function recoveryFixture() {
    const target = await recoveryTarget(); let code = "";
    const { recoveryId } = await initiateRecovery(dbA, target, async email => { if (email.idempotencyKey?.startsWith("recovery-code-")) code = email.code!; });
    return { ...target, recoveryId, code };
  }
  const finish = (db: Db, f: Awaited<ReturnType<typeof recoveryFixture>>) => completeRecovery(db, { email: f.newEmail, code: f.code, secret }, noEmail);
  await check("R13 two recovery completions produce one winner", async () => {
    const f = await recoveryFixture(); const results: boolean[] = [];
    const errors = await lockedScenario("support_cases", f.caseId, [() => finish(dbA, f).then(r => { results.push(r.ok); }), () => finish(dbB, f).then(r => { results.push(r.ok); })]);
    assert(errors.every(e => !e)); assert.deepEqual(results.sort(), [false, true]);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM activity_events WHERE support_case_id=$1 AND type='account_recovery_completed'", [f.caseId])).rows[0].n, 1);
  });
  await check("R14 recovery vs self-service email update has no lost update", async () => {
    const f = await recoveryFixture(); const changed = `${randomUUID()}@example.test`; let completed = false;
    const errors = await lockedScenario("accounts", f.accountId, [() => finish(dbA, f).then(r => { completed = r.ok; }), () => dbB.execute(sql`UPDATE accounts SET email=${changed} WHERE id=${f.accountId}`)]);
    assert(errors.every(e => !e));
    assert.equal((await admin.query("SELECT email FROM accounts WHERE id=$1", [f.accountId])).rows[0].email, changed);
    assert.equal((await admin.query("SELECT status FROM account_recoveries WHERE id=$1", [f.recoveryId])).rows[0].status, completed ? "completed" : "pending");
  });
  await check("R15 recovery vs same-Account Card claim waits without deadlock", async () => {
    const f = await recoveryFixture(); const card = await fixture(); let recovered = false; let claimed = "";
    const errors = await lockedScenario("accounts", f.accountId, [() => finish(dbA, f).then(r => { recovered = r.ok; }), () => claimCard(dbB, { credentialId: card.credentialId, accountId: f.accountId }).then(r => { claimed = r.status; })]);
    assert(errors.every(e => !e)); assert(recovered); assert.equal(claimed, "claimed");
    assert.equal((await admin.query("SELECT owner_account_id FROM cards WHERE id=$1", [card.cardId])).rows[0].owner_account_id, f.accountId);
  });
  await check("R16 two initiations for one Account produce one pending recovery", async () => {
    const f = await recoveryTarget();
    const other = await openCase(dbA, { actorId: owner, type: "account_recovery", summary: "Synthetic second recovery", accountId: f.accountId });
    const errors = await lockedScenario("accounts", f.accountId, [() => initiateRecovery(dbA, f, noEmail), () => initiateRecovery(dbB, { ...f, caseId: other.caseId, newEmail: `${randomUUID()}@example.test` }, noEmail)]);
    single(errors, "recovery_live");
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM account_recoveries WHERE account_id=$1 AND status='pending'", [f.accountId])).rows[0].n, 1);
  });
  await check("R16 two Accounts cannot reserve one new email", async () => {
    const first = await recoveryTarget(), second = await recoveryTarget();
    const errors = await lockedScenario("support_cases", first.caseId, [() => initiateRecovery(dbB, { ...second, newEmail: first.newEmail }, noEmail)], async holder => { await initiateRecovery(holder, first, noEmail); });
    assert.equal(errorCode(errors[0]), "recovery_live");
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM account_recoveries WHERE new_email=$1 AND status='pending'", [first.newEmail])).rows[0].n, 1);
  });
  await check("R17 intake double submit creates one case and one acknowledgement", async () => {
    const key = hmacHex(secret, "support-global", "all"); await consumeQuota(dbA, key, 100);
    const input = { email: `${randomUUID()}@example.test`, category: "other", message: "Synthetic support request", clientKey: randomUUID() }; const results: boolean[] = [];
    const errors = await lockedScenario("auth_otp_quotas", key, [() => submitSupportRequest(dbA, input, { secret, ip: "synthetic-a" }).then(r => { results.push(r.acknowledge); }), () => submitSupportRequest(dbB, input, { secret, ip: "synthetic-b" }).then(r => { results.push(r.acknowledge); })]);
    assert(errors.every(e => !e)); assert.deepEqual(results.sort(), [false, true]);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM support_cases WHERE client_key=$1", [input.clientKey])).rows[0].n, 1);
  });
  await check("R18 recovery vs owner Card reset serializes without inversion", async () => {
    const f = await recoveryFixture(), card = await fixture(); await claimCard(dbA, { credentialId: card.credentialId, accountId: f.accountId }); let recovered = false;
    const errors = await lockedScenario("accounts", f.accountId, [() => finish(dbA, f).then(r => { recovered = r.ok; }), () => resetCardOwnership(dbB, { ...card, verificationNote: "Synthetic purchase verified", activationSecret: secret })]);
    assert(errors.every(e => !e)); assert(recovered);
    assert.deepEqual((await admin.query("SELECT owner_account_id,profile_id FROM cards WHERE id=$1", [card.cardId])).rows[0], { owner_account_id: null, profile_id: null });
  });
  await check("R19 recovery vs Account-then-Card profile setup has no deadlock", async () => {
    const f = await recoveryFixture(), card = await fixture(); await claimCard(dbA, { credentialId: card.credentialId, accountId: f.accountId }); let recovered = false; let profileId = "";
    const errors = await lockedScenario("accounts", f.accountId, [() => finish(dbA, f).then(r => { recovered = r.ok; }), () => createProfileFromStarter(dbB, { accountId: f.accountId, cardId: card.cardId, purpose: "network", essentials: { fullName: "Synthetic recovery profile", headline: null, bio: null, email: null, phone: null, link: null } }).then(r => { profileId = r.profileId; })]);
    assert(errors.every(e => !e)); assert(recovered); assert(profileId);
    assert.deepEqual((await admin.query("SELECT owner_account_id,profile_id FROM cards WHERE id=$1", [card.cardId])).rows[0], { owner_account_id: f.accountId, profile_id: profileId });
  });
  await check("R20 an expired locked quota row does not block support intake", async () => {
    const key = hmacHex(secret, "expired-r20", randomUUID());
    await admin.query("INSERT INTO auth_otp_quotas(key,count,window_started_at) VALUES($1,1,now()-interval '25 hours')", [key]);
    const holder = await connect(), worker = await connect();
    await worker.query("SET statement_timeout = '1500ms'");
    await holder.query("BEGIN");
    try {
      await holder.query("SELECT key FROM auth_otp_quotas WHERE key=$1 FOR UPDATE", [key]);
      const db = drizzle({ client: worker, schema, casing: "snake_case" });
      const result = await submitSupportRequest(db, { email: `${randomUUID()}@example.test`, category: "other", message: "Synthetic cleanup request", clientKey: randomUUID() }, { secret, ip: "synthetic-r20" });
      assert(result.caseId);
      assert.equal((await admin.query("SELECT count(*)::int AS n FROM auth_otp_quotas WHERE key=$1", [key])).rows[0].n, 1);
    } finally { await holder.query("COMMIT"); }
    await consumeQuota(dbA, hmacHex(secret, "after-r20", "prune"), 1);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM auth_otp_quotas WHERE key=$1", [key])).rows[0].n, 0);
  });
  assert.equal(failures.length, 0, `${failures.length} support concurrency checks failed`);
  console.log("All R1–R20 support races passed (26 scenarios). No remote database accessed.");
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  await Promise.all(clients.map((client) => client.end()));
}
