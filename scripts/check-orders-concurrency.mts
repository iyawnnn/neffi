// Real two-session Order regressions. Disposable loopback database only; never loads .env.local.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../src/db/schema";
import { randomCrockford } from "../src/lib/crockford";
import { cancelOrder } from "../src/modules/orders/cancel";
import { allocateDbcCards } from "../src/modules/orders/allocation";
import { revealActivationCode } from "../src/modules/activation/retrieval";
import { recordNfcCheck, retireCard } from "../src/modules/cards/card";
import { matchPackage, replaceProvisioningCredential } from "../src/modules/cards/dbc";
import { cardUrl } from "../src/modules/cards/token";
import { createPaidDbcOrder } from "../src/modules/orders/normal-dbc";
import { normalOrderInput, syntheticCredentialSecrets } from "../src/modules/orders/operations-test-fixtures";
import { receiveStock } from "../src/modules/inventory/stock-intake";
import { markJntShipped, saveJntDelivery } from "../src/modules/orders/jnt-fulfillment";
import { handOverOrder, reserveDbcCards } from "../src/modules/orders/fulfillment";
import { recordPayment, recordRefund } from "../src/modules/payments/record";
import { voidPayment, voidRefund } from "../src/modules/payments/void";

const url = new URL(process.env.DATABASE_URL_TEST ?? "");
assert.equal(url.hostname, "127.0.0.1", "Concurrency checks require a disposable loopback database");
assert.equal(url.pathname, "/neffi_m2_test");
assert(["postgres:", "postgresql:"].includes(url.protocol));
assert(![...url.searchParams.keys()].some((key) => ["host", "hostaddr", "port"].includes(key)));

const clients: pg.Client[] = [];
const pools: pg.Pool[] = [];
const failures: string[] = [];
const connect = async () => {
  const client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  await client.connect();
  await client.query("SET statement_timeout = '15s'");
  clients.push(client);
  return client;
};
const database = () => {
  const pool = new pg.Pool({ connectionString: url.href, max: 2, options: "-c statement_timeout=15000" });
  pools.push(pool);
  return drizzle({ client: pool, schema, casing: "snake_case" });
};
const settle = (promise: Promise<unknown>) => {
  const state = { done: false, error: undefined as unknown };
  const finished = promise.then(() => { state.done = true; }, (error: unknown) => { state.done = true; state.error = error; });
  return { state, finished };
};
const errorCode = (error: unknown) => (error as { code?: string } | undefined)?.code;
async function check(label: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${label}`); }
  catch (error) { failures.push(label); console.error(`FAIL ${label}: ${error instanceof assert.AssertionError ? error.message : "database/domain error"}`); }
}

try {
  const admin = await connect();
  const { rows: [server] } = await admin.query("SELECT current_setting('neon.project_id', true) AS neon");
  assert(!server.neon, "Concurrency checks must never target Neon");
  const [dbA, dbB] = [database(), database()];
  // Existing synthetic test fixtures are historical; services need one active catalog product per kind.
  await admin.query("UPDATE products SET active=false");
  await migrate(dbA, { migrationsFolder: "drizzle" });
  const [owner, purchaser, dbc, grc, stock] = Array.from({ length: 5 }, () => randomUUID());
  await admin.query("INSERT INTO accounts(id,name,email,role) VALUES($1,'Synthetic Order owner',$2,'owner')", [owner, `${owner}@example.test`]);
  await admin.query("INSERT INTO purchasers(id,name) VALUES($1,'Synthetic Order buyer')", [purchaser]);
  await admin.query("INSERT INTO products(id,kind,name,price) VALUES($1,'dbc','Synthetic DBC',100),($2,'grc','Synthetic GRC',100)", [dbc, grc]);
  await admin.query("INSERT INTO stock_purchases(id,received_on,created_by_account_id) VALUES($1,'2026-10-13',$2)", [stock, owner]);

  const makeOrder = async (kind: "dbc" | "grc", reserved = false) => {
    const orderId = randomUUID();
    const itemId = randomUUID();
    await admin.query("INSERT INTO orders(id,purchaser_id,created_by_account_id,assigned_to_account_id,delivery_method) VALUES($1,$2,$3,$3,'pickup')", [orderId, purchaser, owner]);
    await admin.query("INSERT INTO order_items(id,order_id,product_id,product_kind,quantity,unit_price) VALUES($1,$2,$3,$4,1,100)", [itemId, orderId, kind === "dbc" ? dbc : grc, kind]);
    const input = { orderId, actorId: owner };
    let cardId: string | undefined;
    if (kind === "dbc") {
      cardId = randomUUID();
      await admin.query("INSERT INTO cards(id,stock_purchase_id,product_id,kind,public_token) VALUES($1,$2,$3,'dbc',$4)", [cardId, stock, dbc, randomCrockford(26)]);
      await admin.query("INSERT INTO activation_credentials(card_id,lookup_hmac) VALUES($1,$2)", [cardId, randomUUID().replaceAll("-", "").padEnd(64, "0")]);
      await admin.query("UPDATE cards SET state='ready',nfc_verified_at=now(),package_matched_at=now() WHERE id=$1", [cardId]);
      if (reserved) await reserveDbcCards(dbA, { ...input, orderItemId: itemId, cardIds: [cardId] });
    }
    return { input, itemId, cardId };
  };

  // Confirm both service sessions really wait on the held row, then release them to race.
  const lockedScenario = async (table: "orders" | "cards", id: string, calls: (() => Promise<unknown>)[]) => {
    const holder = await connect();
    const { rows: [{ pid }] } = await holder.query("SELECT pg_backend_pid() AS pid");
    await holder.query("BEGIN");
    await holder.query(`SELECT id FROM ${table} WHERE id=$1 FOR ${table === "orders" ? "NO KEY UPDATE" : "UPDATE"}`, [id]);
    const pending = calls.map((call) => settle(call()));
    try {
      let waiting = 0;
      for (const deadline = Date.now() + 5000; waiting < calls.length && !pending.some((p) => p.state.done) && Date.now() < deadline;) {
        const { rows: [row] } = await admin.query(`WITH RECURSIVE blocked(pid) AS (
          SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))
          UNION
          SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid=ANY(pg_blocking_pids(a.pid))
        ) SELECT count(*)::int AS n FROM blocked`, [pid]);
        waiting = row.n;
        if (waiting < calls.length) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(waiting, calls.length, `Every racing service must demonstrate an actual row-lock wait; completed codes: ${pending.map((p) => p.state.done ? errorCode(p.state.error) ?? "success" : "pending").join(",")}`);
      await holder.query("COMMIT");
      await Promise.all(pending.map((p) => p.finished));
      return pending.map((p) => p.state.error);
    } finally {
      await holder.query("ROLLBACK");
      await Promise.all(pending.map((p) => p.finished));
    }
  };
  const orderState = async (id: string) => (await admin.query("SELECT status FROM orders WHERE id=$1", [id])).rows[0].status as string;
  const eventCount = async (id: string, type: string) => (await admin.query("SELECT count(*)::int AS n FROM activity_events WHERE order_id=$1 AND type=$2", [id, type])).rows[0].n as number;

  await check("concurrent final payments: exactly one succeeds at the balance", async () => {
    const { input } = await makeOrder("dbc");
    const pay = { ...input, method: "cash" as const };
    const errors = await lockedScenario("orders", input.orderId, [() => recordPayment(dbA, pay), () => recordPayment(dbB, pay)]);
    assert.equal(errors.filter((e) => !e).length, 1);
    assert.equal(errorCode(errors.find(Boolean)), "balance_exceeded");
    assert.equal((await admin.query("SELECT sum(amount)::int AS n FROM payments WHERE order_id=$1 AND voided_at IS NULL", [input.orderId])).rows[0].n, 100);
  });

  await check("two Orders competing for one Ready DBC: exactly one wins", async () => {
    const a = await makeOrder("dbc");
    const b = await makeOrder("dbc");
    const cardId = a.cardId!;
    const errors = await lockedScenario("cards", cardId, [
      () => reserveDbcCards(dbA, { ...a.input, orderItemId: a.itemId, cardIds: [cardId] }),
      () => reserveDbcCards(dbB, { ...b.input, orderItemId: b.itemId, cardIds: [cardId] }),
    ]);
    assert.equal(errors.filter((e) => !e).length, 1);
    assert.equal(errorCode(errors.find(Boolean)), "card_unavailable");
    const { rows: [card] } = await admin.query("SELECT state,order_item_id FROM cards WHERE id=$1", [cardId]);
    assert.equal(card.state, "reserved");
    assert.equal(card.order_item_id, errors[0] ? b.itemId : a.itemId);
  });

  for (const kind of ["dbc", "grc"] as const) {
    await check(`cancel vs ${kind === "dbc" ? "DBC release" : "GRC commercial handover"}: one consistent outcome`, async () => {
      const { input, cardId } = await makeOrder(kind, kind === "dbc");
      const errors = await lockedScenario("orders", input.orderId, [() => cancelOrder(dbA, input), () => handOverOrder(dbB, input)]);
      assert.equal(errors.filter((e) => !e).length, 1);
      const status = await orderState(input.orderId);
      assert.equal(status, errors[0] ? "in_progress" : "cancelled");
      assert.equal(await eventCount(input.orderId, "order_handed_over"), errors[0] ? 1 : 0);
      if (cardId) assert.equal((await admin.query("SELECT state FROM cards WHERE id=$1", [cardId])).rows[0].state, errors[0] ? "released" : "ready");
      assert.equal(errorCode(errors.find(Boolean)), errors[0] ? "already_released" : "wrong_status");
    });

    await check(`payment + ${kind === "dbc" ? "DBC release" : "GRC commercial handover"}: exactly one completion`, async () => {
      const { input } = await makeOrder(kind, kind === "dbc");
      const errors = await lockedScenario("orders", input.orderId, [() => recordPayment(dbA, { ...input, method: "cash" }), () => handOverOrder(dbB, input)]);
      assert(errors.every((e) => !e), "Both independent inputs must succeed");
      assert.equal(await orderState(input.orderId), "completed");
      assert.equal(await eventCount(input.orderId, "order_completed"), 1);
    });
  }

  await check("cancelled refund void vs refund record: cap and totals consistent", async () => {
    const { input } = await makeOrder("grc");
    await recordPayment(dbA, { ...input, method: "cash" });
    await recordRefund(dbA, { ...input, method: "cash", amount: 40 });
    await cancelOrder(dbA, input);
    const { rows: [refund] } = await admin.query("SELECT id FROM refunds WHERE order_id=$1", [input.orderId]);
    const errors = await lockedScenario("orders", input.orderId, [
      () => voidRefund(dbA, { ...input, refundId: refund.id, reason: "Synthetic mis-keyed refund" }),
      () => recordRefund(dbB, { ...input, method: "cash", amount: 80 }),
    ]);
    assert(!errors[0], "Refund void is allowed on Cancelled");
    if (errors[1]) assert.equal(errorCode(errors[1]), "refund_exceeded");
    const { rows: [totals] } = await admin.query("SELECT (SELECT sum(amount)::int FROM payments WHERE order_id=$1 AND voided_at IS NULL) AS paid, coalesce((SELECT sum(amount)::int FROM refunds WHERE order_id=$1 AND voided_at IS NULL),0) AS refunded", [input.orderId]);
    assert.equal(totals.paid, 100);
    assert.equal(totals.refunded, errors[1] ? 0 : 80);
    assert.equal(await orderState(input.orderId), "cancelled");
  });

  // Fresh product isolates automatic allocation from Ready inventory used by the legacy checks above.
  const allocationProduct = randomUUID();
  const secrets = syntheticCredentialSecrets();
  await admin.query("UPDATE products SET active=false WHERE kind='dbc'");
  await admin.query("INSERT INTO products(id,kind,name,price) VALUES($1,'dbc','Synthetic allocation DBC',79900)", [allocationProduct]);
  await admin.query("UPDATE cards SET product_id=$1,kind='dbc' WHERE state='blank' AND product_id IS NULL AND kind IS NULL AND order_item_id IS NULL", [dbc]);
  const waiting = async () => (await createPaidDbcOrder(dbA, normalOrderInput(owner, { secrets }))).orderId;
  const linkedCards = async (orderId: string) => (await admin.query("SELECT c.id,c.state FROM cards c JOIN order_items i ON i.id=c.order_item_id WHERE i.order_id=$1 AND c.state IN ('preparing','reserved','released')", [orderId])).rows as { id: string; state: string }[];
  const readyForAllocation = async () => {
    const cardId = randomUUID();
    await admin.query("INSERT INTO cards(id,stock_purchase_id,product_id,kind,public_token) VALUES($1,$2,$3,'dbc',$4)", [cardId, stock, allocationProduct, randomCrockford(26)]);
    await admin.query("INSERT INTO activation_credentials(card_id,lookup_hmac) VALUES($1,$2)", [cardId, randomUUID().replaceAll("-", "").padEnd(64, "0")]);
    await admin.query("UPDATE cards SET state='ready',nfc_verified_at=now(),package_matched_at=now() WHERE id=$1", [cardId]);
    return cardId;
  };
  const blankForAllocation = async () => {
    const cardId = randomUUID();
    await admin.query("INSERT INTO cards(id,stock_purchase_id) VALUES($1,$2)", [cardId, stock]);
    return cardId;
  };
  const preparing = async () => {
    const orderId = await waiting();
    const cardId = await blankForAllocation();
    assert.deepEqual((await allocateDbcCards(dbA, { actorId: owner, orderId, secrets })).allocatedCardIds, [cardId]);
    const { rows: [card] } = await admin.query("SELECT public_token,order_item_id FROM cards WHERE id=$1", [cardId]);
    const { rows: [credential] } = await admin.query("SELECT id FROM activation_credentials WHERE card_id=$1 AND used_at IS NULL AND revoked_at IS NULL", [cardId]);
    const revealed = await revealActivationCode(dbA, { actorId: owner, cardId, credentialId: credential.id, secrets });
    assert.equal(revealed.status, "available");
    if (revealed.status !== "available") throw new Error("Synthetic credential unavailable");
    return { orderId, cardId, itemId: card.order_item_id as string, credentialId: credential.id as string, token: card.public_token as string, code: revealed.code };
  };
  const checkNfc = (cardId: string, token: string) => recordNfcCheck(dbA, {
    actorId: owner, cardId, cardUrlOrigin: "https://getneffi.com", readBackUri: cardUrl("https://getneffi.com", token),
    readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true,
  });

  await check("two paid Orders compete for one Ready DBC without duplicate assignment", async () => {
    const [first, second] = [await waiting(), await waiting()];
    const cardId = await readyForAllocation();
    await Promise.all([allocateDbcCards(dbA, { actorId: owner, orderId: first, secrets }), allocateDbcCards(dbB, { actorId: owner, orderId: second, secrets })]);
    const assigned = [...await linkedCards(first), ...await linkedCards(second)];
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].id, cardId);
    assert.equal(assigned[0].state, "reserved");
  });

  await check("two paid Orders compete for one virgin Blank without duplicate code", async () => {
    const [first, second] = [await waiting(), await waiting()];
    const cardId = await blankForAllocation();
    await Promise.all([allocateDbcCards(dbA, { actorId: owner, orderId: first, secrets }), allocateDbcCards(dbB, { actorId: owner, orderId: second, secrets })]);
    const assigned = [...await linkedCards(first), ...await linkedCards(second)];
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].id, cardId);
    assert.equal(assigned[0].state, "preparing");
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1", [cardId])).rows[0].n, 1);
  });

  await check("same Order double allocation serializes on its row", async () => {
    const orderId = await waiting();
    const cardId = await blankForAllocation();
    const errors = await lockedScenario("orders", orderId, [() => allocateDbcCards(dbA, { actorId: owner, orderId, secrets }), () => allocateDbcCards(dbB, { actorId: owner, orderId, secrets })]);
    assert(errors.every((error) => !error));
    assert.deepEqual((await linkedCards(orderId)).map((card) => card.id), [cardId]);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1", [cardId])).rows[0].n, 1);
  });

  await check("Ready row locked by another allocator is skipped and later retried", async () => {
    const orderId = await waiting();
    const cardId = await readyForAllocation();
    const holder = await connect();
    await holder.query("BEGIN");
    try {
      await holder.query("SELECT id FROM cards WHERE id=$1 FOR UPDATE", [cardId]);
      assert.equal((await allocateDbcCards(dbA, { actorId: owner, orderId, secrets })).missingQuantity, 1);
    } finally { await holder.query("ROLLBACK"); }
    assert.deepEqual((await allocateDbcCards(dbB, { actorId: owner, orderId, secrets })).allocatedCardIds, [cardId]);
  });

  await check("package match vs cancel preserves one coherent returned card", async () => {
    const f = await preparing();
    await checkNfc(f.cardId, f.token);
    const errors = await lockedScenario("orders", f.orderId, [
      () => matchPackage(dbA, { actorId: owner, cardId: f.cardId, activationCode: f.code, activationSecret: secrets.lookupSecret }),
      () => cancelOrder(dbB, { actorId: owner, orderId: f.orderId }),
    ]);
    assert.equal(errors[1], undefined);
    if (errors[0]) assert.equal(errorCode(errors[0]), "retry");
    const { rows: [card] } = await admin.query("SELECT state,order_item_id,public_token,nfc_verified_at,package_matched_at FROM cards WHERE id=$1", [f.cardId]);
    assert.equal(card.order_item_id, null);
    assert.equal(card.public_token, f.token);
    assert(card.nfc_verified_at);
    assert(["blank", "ready"].includes(card.state));
    assert.equal(Boolean(card.package_matched_at), card.state === "ready");
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1", [f.cardId])).rows[0].n, 1);
  });

  await check("NFC check vs cancel retains identity without partial evidence", async () => {
    const f = await preparing();
    const errors = await lockedScenario("orders", f.orderId, [
      () => checkNfc(f.cardId, f.token),
      () => cancelOrder(dbB, { actorId: owner, orderId: f.orderId }),
    ]);
    assert.equal(errors[1], undefined);
    if (errors[0]) assert.equal(errorCode(errors[0]), "retry");
    const { rows: [card] } = await admin.query("SELECT state,order_item_id,public_token,nfc_verified_at FROM cards WHERE id=$1", [f.cardId]);
    assert.equal(card.state, "blank");
    assert.equal(card.order_item_id, null);
    assert.equal(card.public_token, f.token);
    assert.equal(Boolean(card.nfc_verified_at), !errors[0]);
  });

  await check("code reveal vs cancel follows the linked Order lock", async () => {
    const f = await preparing();
    const errors = await lockedScenario("orders", f.orderId, [
      () => revealActivationCode(dbA, { actorId: owner, cardId: f.cardId, credentialId: f.credentialId, secrets }),
      () => cancelOrder(dbB, { actorId: owner, orderId: f.orderId }),
    ]);
    assert(errors.every((error) => !error));
    assert.deepEqual((await admin.query("SELECT state,order_item_id,public_token FROM cards WHERE id=$1", [f.cardId])).rows[0], { state: "blank", order_item_id: null, public_token: f.token });
  });

  await check("allocation vs failed Preparing retirement leaves one replacement", async () => {
    const f = await preparing();
    const replacement = await blankForAllocation();
    const errors = await lockedScenario("orders", f.orderId, [
      () => retireCard(dbA, { actorId: owner, cardId: f.cardId, reason: "Synthetic failure", secrets }),
      () => allocateDbcCards(dbB, { actorId: owner, orderId: f.orderId, secrets }),
    ]);
    assert(errors.every((error) => !error));
    const { rows: [failed] } = await admin.query("SELECT state,order_item_id FROM cards WHERE id=$1", [f.cardId]);
    assert.deepEqual(failed, { state: "retired", order_item_id: f.itemId });
    assert.deepEqual((await linkedCards(f.orderId)).map((card) => card.id), [replacement]);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1 AND revoked_at IS NOT NULL AND encrypted_code IS NULL", [f.cardId])).rows[0].n, 1);
  });

  await check("credential replacement vs package match requires new package proof", async () => {
    const f = await preparing();
    await checkNfc(f.cardId, f.token);
    const errors = await lockedScenario("orders", f.orderId, [
      () => replaceProvisioningCredential(dbA, { actorId: owner, cardId: f.cardId, credentialId: f.credentialId, reason: "Synthetic correction", secrets }),
      () => matchPackage(dbB, { actorId: owner, cardId: f.cardId, activationCode: f.code, activationSecret: secrets.lookupSecret }),
    ]);
    assert.equal(errors[0], undefined);
    if (errors[1]) assert.equal(errorCode(errors[1]), "code_mismatch");
    const { rows: [card] } = await admin.query("SELECT state,order_item_id,nfc_verified_at,package_matched_at FROM cards WHERE id=$1", [f.cardId]);
    assert.equal(card.state, "preparing");
    assert.equal(card.order_item_id, f.itemId);
    assert(card.nfc_verified_at);
    assert.equal(card.package_matched_at, null);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1 AND used_at IS NULL AND revoked_at IS NULL", [f.cardId])).rows[0].n, 1);
  });

  await check("unlinked snapshot raced by allocation returns a data-free retry and changes nothing", async () => {
    const orderId = await waiting();
    const { rows: [item] } = await admin.query("SELECT id,product_id FROM order_items WHERE order_id=$1", [orderId]);
    const cardId = randomUUID();
    await admin.query("INSERT INTO cards(id,stock_purchase_id,product_id,kind,public_token) VALUES($1,$2,$3,'dbc',$4)", [cardId, stock, item.product_id, randomCrockford(26)]);
    const { rows: [credential] } = await admin.query("INSERT INTO activation_credentials(card_id,lookup_hmac) VALUES($1,$2) RETURNING id", [cardId, randomUUID().replaceAll("-", "").padEnd(64, "0")]);
    await admin.query("UPDATE cards SET state='ready',nfc_verified_at=now(),package_matched_at=now() WHERE id=$1", [cardId]);
    const holder = await connect();
    await holder.query("BEGIN");
    await holder.query("SELECT id FROM cards WHERE id=$1 FOR UPDATE", [cardId]);
    const racing = settle(replaceProvisioningCredential(dbB, { actorId: owner, cardId, credentialId: credential.id, reason: "Synthetic race", secrets }));
    try {
      for (const deadline = Date.now() + 5000; Date.now() < deadline;) {
        const { rows: [row] } = await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query ILIKE '%from \"cards\"%'");
        if (row.n) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await holder.query("UPDATE cards SET state='reserved',order_item_id=$2 WHERE id=$1", [cardId, item.id]);
      await holder.query("COMMIT");
      await racing.finished;
    } finally {
      await holder.query("ROLLBACK");
      await racing.finished;
    }
    assert.equal(errorCode(racing.state.error), "retry");
    assert.equal((racing.state.error as Error).message, "retry");
    assert.deepEqual((await admin.query("SELECT state,order_item_id FROM cards WHERE id=$1", [cardId])).rows[0], { state: "reserved", order_item_id: item.id });
    assert.deepEqual((await admin.query("SELECT id FROM activation_credentials WHERE card_id=$1 AND used_at IS NULL AND revoked_at IS NULL", [cardId])).rows, [{ id: credential.id }]);
  });

  const shippable = async (shippingFee?: number) => {
    await readyForAllocation();
    const { orderId } = await createPaidDbcOrder(dbA, normalOrderInput(owner, { secrets, delivery: { method: "jnt", recipientName: "Synthetic Recipient", recipientPhone: "0917 000 0000", address: "1 Synthetic Street", shippingFee } }));
    assert.equal((await linkedCards(orderId)).length, 1);
    return orderId;
  };
  const shipState = async (orderId: string) => {
    const { rows: [order] } = await admin.query("SELECT status,shipping_fee,shipping_fee_pending FROM orders WHERE id=$1", [orderId]);
    const { rows: payments } = await admin.query("SELECT amount FROM payments WHERE order_id=$1 AND voided_at IS NULL ORDER BY amount DESC", [orderId]);
    const { rows: shipments } = await admin.query("SELECT status,shipped_on FROM shipments WHERE order_id=$1", [orderId]);
    const events = async (type: string) => (await admin.query("SELECT count(*)::int AS n FROM activity_events WHERE order_id=$1 AND type=$2", [orderId, type])).rows[0].n as number;
    return { order, payments: payments.map((p) => p.amount as number), shipments, cards: (await linkedCards(orderId)).map((c) => c.state), events };
  };
  const track = { trackingNumber: "SYNTH-TRACK" };

  await check("ship vs cancel has one terminal outcome and no hidden partial effects", async () => {
    const orderId = await shippable(12_000);
    const errors = await lockedScenario("orders", orderId, [
      () => markJntShipped(dbA, { actorId: owner, orderId, ...track }),
      () => cancelOrder(dbB, { actorId: owner, orderId }),
    ]);
    assert.equal([errors[0], errors[1]].filter(Boolean).length, 1);
    const state = await shipState(orderId);
    if (!errors[0]) {
      assert.equal(errorCode(errors[1]), "wrong_status");
      assert.deepEqual([state.order.status, state.payments, state.cards, state.shipments[0].status], ["completed", [79_900, 12_000], ["released"], "in_transit"]);
    } else {
      assert.equal(errorCode(errors[0]), "wrong_status");
      assert.deepEqual([state.order.status, state.payments, state.cards, state.shipments[0].status, state.shipments[0].shipped_on], ["cancelled", [79_900], [], "pending", null]);
    }
  });

  await check("double Mark as shipped makes one receipt, one release and one completion", async () => {
    const orderId = await shippable(12_000);
    const errors = await lockedScenario("orders", orderId, [
      () => markJntShipped(dbA, { actorId: owner, orderId, ...track }),
      () => markJntShipped(dbB, { actorId: owner, orderId, ...track }),
    ]);
    assert(errors.every((error) => !error));
    const state = await shipState(orderId);
    assert.deepEqual([state.order.status, state.payments, state.cards, state.shipments.length], ["completed", [79_900, 12_000], ["released"], 1]);
    assert.deepEqual([await state.events("order_completed"), await state.events("shipment_recorded"), await state.events("card_released")], [1, 1, 1]);
  });

  await check("fee save vs Mark as shipped commits one consistent fee and receipt", async () => {
    const orderId = await shippable();
    const errors = await lockedScenario("orders", orderId, [
      () => saveJntDelivery(dbA, { actorId: owner, orderId, recipientName: "Saved Name", recipientPhone: "0999", address: "2 Saved Street", shippingFee: 5_000 }),
      () => markJntShipped(dbB, { actorId: owner, orderId, ...track, shippingFee: 7_000 }),
    ]);
    assert.equal(errors[1], undefined);
    if (errors[0]) assert.equal(errorCode(errors[0]), "wrong_status");
    const state = await shipState(orderId);
    assert.deepEqual([state.order.status, state.order.shipping_fee_pending, state.cards], ["completed", false, ["released"]]);
    assert.deepEqual(state.payments, [79_900, 7_000]);
    assert.equal(state.order.shipping_fee, 7_000);
  });

  await check("product receipt void vs Mark as shipped never fabricates collection", async () => {
    const orderId = await shippable(12_000);
    const { rows: [product] } = await admin.query("SELECT id FROM payments WHERE order_id=$1", [orderId]);
    const errors = await lockedScenario("orders", orderId, [
      () => markJntShipped(dbA, { actorId: owner, orderId, ...track }),
      () => voidPayment(dbB, { actorId: owner, orderId, paymentId: product.id, reason: "Synthetic correction" }),
    ]);
    const state = await shipState(orderId);
    if (!errors[0]) {
      assert.equal(errorCode(errors[1]), "wrong_status");
      assert.deepEqual([state.order.status, state.payments], ["completed", [79_900, 12_000]]);
    } else {
      assert.equal(errorCode(errors[0]), "settlement_mismatch");
      assert.equal(errors[1], undefined);
      assert.deepEqual([state.order.status, state.payments, state.cards, state.shipments[0].status], ["in_progress", [], ["reserved"], "pending"]);
    }
  });

  for (const target of ["payments", "shipments", "activity_events"] as const) await check(`failure injected in ${target} rolls back the whole Mark as shipped`, async () => {
    const orderId = await shippable();
    const condition = target === "payments" ? "true" : target === "shipments" ? "NEW.status = 'in_transit'" : "NEW.type = 'shipment_recorded'";
    const when = target === "shipments" ? "BEFORE UPDATE" : "BEFORE INSERT";
    await admin.query(`CREATE OR REPLACE FUNCTION synthetic_ship_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} AND NEW.id IS NOT NULL THEN RAISE EXCEPTION 'synthetic ship failure'; END IF; RETURN NEW; END $$`);
    await admin.query(`CREATE TRIGGER synthetic_ship_failure ${when} ON ${target} FOR EACH ROW WHEN (${target === "payments" ? "NEW.amount = 12000" : "true"}) EXECUTE FUNCTION synthetic_ship_failure()`);
    try {
      await assert.rejects(markJntShipped(dbA, { actorId: owner, orderId, ...track, shippingFee: 12_000 }));
    } finally {
      await admin.query(`DROP TRIGGER synthetic_ship_failure ON ${target}`);
    }
    const state = await shipState(orderId);
    assert.deepEqual([state.order.status, state.order.shipping_fee_pending, state.order.shipping_fee, state.payments, state.cards, state.shipments[0].status, state.shipments[0].shipped_on], ["in_progress", true, 0, [79_900], ["reserved"], "pending", null]);
    assert.deepEqual([await state.events("shipment_recorded"), await state.events("card_released"), await state.events("order_completed")], [0, 0, 0]);
  });

  await check("multi-card reservation locks fixed IDs from lowest to highest", async () => {
    await admin.query("UPDATE products SET active=false WHERE id=$1", [allocationProduct]);
    await admin.query("UPDATE cards SET product_id=$1,kind='dbc' WHERE state='blank' AND product_id IS NULL AND kind IS NULL AND order_item_id IS NULL", [allocationProduct]);
    const multiProduct = randomUUID();
    await admin.query("INSERT INTO products(id,kind,name,price) VALUES($1,'dbc','Synthetic multi-card DBC',79900)", [multiProduct]);
    const [first, second] = [await waiting(), await waiting()];
    assert.deepEqual(await linkedCards(first), []);
    assert.deepEqual(await linkedCards(second), []);
    const { rows: [firstItem] } = await admin.query("SELECT id FROM order_items WHERE order_id=$1", [first]);
    const { rows: [secondItem] } = await admin.query("SELECT id FROM order_items WHERE order_id=$1", [second]);
    await admin.query("UPDATE order_items SET quantity=2 WHERE id=$1", [firstItem.id]);
    const high = `f${randomUUID().slice(1)}`, low = `0${randomUUID().slice(1)}`;
    for (const cardId of [high, low]) {
      await admin.query("INSERT INTO cards(id,stock_purchase_id,product_id,kind,public_token) VALUES($1,$2,$3,'dbc',$4)", [cardId, stock, multiProduct, randomCrockford(26)]);
      await admin.query("INSERT INTO activation_credentials(card_id,lookup_hmac) VALUES($1,$2)", [cardId, randomUUID().replaceAll("-", "").padEnd(64, "0")]);
      await admin.query("UPDATE cards SET state='ready',nfc_verified_at=now(),package_matched_at=now() WHERE id=$1", [cardId]);
    }
    const errors = await lockedScenario("cards", high, [
      () => reserveDbcCards(dbA, { actorId: owner, orderId: first, orderItemId: firstItem.id, cardIds: [high, low] }),
      () => reserveDbcCards(dbB, { actorId: owner, orderId: second, orderItemId: secondItem.id, cardIds: [low] }),
    ]);
    assert.equal(errors[0], undefined);
    assert.equal(errorCode(errors[1]), "card_unavailable");
    assert.deepEqual((await linkedCards(first)).map((card) => card.id).sort(), [high, low].sort());
  });

  await check("stock-intake retry racing manual Order retry assigns once", async () => {
    await admin.query("UPDATE products SET active=false WHERE kind='dbc'");
    await admin.query("UPDATE cards SET product_id=$1,kind='dbc' WHERE state='blank' AND product_id IS NULL AND kind IS NULL AND order_item_id IS NULL", [allocationProduct]);
    const receiptProduct = randomUUID();
    await admin.query("INSERT INTO products(id,kind,name,price) VALUES($1,'dbc','Synthetic receipt DBC',79900)", [receiptProduct]);
    const orderId = await waiting();
    assert.deepEqual(await linkedCards(orderId), []);
    await admin.query("UPDATE orders SET created_at=(SELECT min(created_at) - interval '1 day' FROM orders) WHERE id=$1", [orderId]);
    let receiptStockPurchaseId: string | undefined;
    const [receiptError, retryError] = await lockedScenario("orders", orderId, [
      () => receiveStock(dbA, { actorId: owner, receivedOn: "2026-10-26", quantity: 1, intendedKind: "dbc", secrets }).then((result) => {
        assert.equal(result.retryFailed, false);
        receiptStockPurchaseId = result.stockPurchaseId;
      }),
      () => allocateDbcCards(dbB, { actorId: owner, orderId, secrets }),
    ]);
    assert.equal(receiptError, undefined);
    assert.equal(retryError, undefined);
    assert(receiptStockPurchaseId);
    const { rows: [receivedCard] } = await admin.query("SELECT id FROM cards WHERE stock_purchase_id=$1 AND product_id=$2", [receiptStockPurchaseId, receiptProduct]);
    assert(receivedCard);
    const assigned = await linkedCards(orderId);
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].id, receivedCard.id);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1", [assigned[0].id])).rows[0].n, 1);
  });

  assert.equal(failures.length, 0, `${failures.length} Order concurrency checks failed`);
  console.log("All 26 Order concurrency scenarios passed. No GRC inventory workflow exercised.");
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  await Promise.all(clients.map((client) => client.end()));
}
