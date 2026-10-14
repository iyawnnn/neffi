// Real row-lock races on disposable loopback PostgreSQL. Never loads .env.local or prints credentials/codes.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../src/db/schema";
import { randomCrockford } from "../src/lib/crockford";
import { issueActivationCredential } from "../src/modules/activation/credentials";
import { claimCard } from "../src/modules/activation/claim";
import { connectCardToProfile, setCardDisabled } from "../src/modules/cards/manage";
import { reserveDbcCards } from "../src/modules/orders/fulfillment";
import { loadOrderFacts } from "../src/modules/orders/order";
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
const errorCode = (error: unknown) => (error as { code?: string } | undefined)?.code;
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
  async function lockedScenario(table: "support_cases" | "orders" | "order_items" | "cards", id: string, calls: (() => Promise<unknown>)[], prepare?: (holder: Db) => Promise<void>) {
    const holder = await connect();
    const { rows: [{ pid }] } = await holder.query("SELECT pg_backend_pid() AS pid");
    let pending: ReturnType<typeof settle>[] = [];
    try {
      await drizzle({ client: holder, schema, casing: "snake_case" }).transaction(async (tx) => {
        await holder.query(`SELECT id FROM ${table} WHERE id=$1 FOR ${table === "support_cases" || table === "orders" ? "NO KEY UPDATE" : "UPDATE"}`, [id]);
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
  assert.equal(failures.length, 0, `${failures.length} support concurrency checks failed`);
  console.log("All R1–R9 support races passed (10 scenarios). No remote database accessed.");
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  await Promise.all(clients.map((client) => client.end()));
}
