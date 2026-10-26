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
import { createPaidDbcOrder } from "../src/modules/orders/normal-dbc";
import { normalOrderInput, syntheticCredentialSecrets } from "../src/modules/orders/operations-test-fixtures";
import { receiveStock } from "../src/modules/inventory/stock-intake";
import { handOverOrder, reserveDbcCards } from "../src/modules/orders/fulfillment";
import { recordPayment, recordRefund } from "../src/modules/payments/record";
import { voidRefund } from "../src/modules/payments/void";

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
      assert.equal(waiting, calls.length, "Every racing service must demonstrate an actual row-lock wait");
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

  await check("stock-intake retry racing manual Order retry assigns once", async () => {
    await receiveStock(dbA, { actorId: owner, receivedOn: "2026-10-25", quantity: 2, intendedKind: "dbc", secrets });
    const orderId = await waiting();
    const [receipt] = await Promise.all([
      receiveStock(dbA, { actorId: owner, receivedOn: "2026-10-26", quantity: 1, intendedKind: "dbc", secrets }),
      allocateDbcCards(dbB, { actorId: owner, orderId, secrets }),
    ]);
    assert.equal(receipt.retryFailed, false);
    const assigned = await linkedCards(orderId);
    assert.equal(assigned.length, 1);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1", [assigned[0].id])).rows[0].n, 1);
  });

  assert.equal(failures.length, 0, `${failures.length} Order concurrency checks failed`);
  console.log("All 12 Order concurrency scenarios passed. No GRC inventory workflow exercised.");
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  await Promise.all(clients.map((client) => client.end()));
}
