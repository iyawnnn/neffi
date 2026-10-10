// Real-PostgreSQL regression for the provisioning services' lock discipline. Runs on a disposable loopback database
// only (never Neon, never .env.local). PGlite cannot hold two sessions open, so row-lock waits and races are proved here.
// Synthetic NFC/package timestamps are written only to this disposable database to set up fixtures.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../src/db/schema";
import { matchPackage, provisionDbc, replaceProvisioningCredential } from "../src/modules/cards/dbc";
import { recordNfcCheck, retireCard, type CardErrorCode } from "../src/modules/cards/card";
import { reserveGrc } from "../src/modules/cards/grc";

const url = new URL(process.env.DATABASE_URL_TEST ?? "");
assert.equal(url.hostname, "127.0.0.1", "Concurrency checks require a disposable loopback database");
assert.equal(url.pathname, "/neffi_m2_test");
assert(["postgres:", "postgresql:"].includes(url.protocol));
assert(![...url.searchParams.keys()].some((key) => ["host", "hostaddr", "port"].includes(key)));

const SECRET = "c".repeat(40);
const ORIGIN = "https://tap.example.test";
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
const settle = <T>(promise: Promise<T>) => {
  const state = { done: false, error: undefined as unknown, value: undefined as T | undefined };
  const finished = promise.then(
    (value) => ((state.done = true), (state.value = value)),
    (error) => ((state.done = true), (state.error = error)),
  );
  return { state, finished };
};

async function check(label: string, run: () => Promise<void>) {
  try {
    await run();
    console.log(`PASS ${label}`);
  } catch (error) {
    failures.push(label);
    console.error(`FAIL ${label}: ${error instanceof assert.AssertionError ? error.message : "database error"}`);
  }
}

try {
  const admin = await connect();
  const { rows: [server] } = await admin.query("SELECT current_setting('neon.project_id', true) AS neon");
  assert(!server.neon, "Concurrency checks must never target Neon");
  const pool = new pg.Pool({ connectionString: url.href, max: 4 });
  pools.push(pool);
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "drizzle" });

  const owner = randomUUID();
  const dbcProduct = randomUUID();
  const grcProduct = randomUUID();
  const stock = randomUUID();
  await admin.query("INSERT INTO accounts(id,name,email) VALUES ($1,'Synthetic concurrency owner',$2)", [owner, `${owner}@example.test`]);
  await admin.query("INSERT INTO products(id,kind,name,price) VALUES ($1,'dbc','Synthetic DBC',100),($2,'grc','Synthetic GRC',100)", [dbcProduct, grcProduct]);
  await admin.query("INSERT INTO stock_purchases(id,received_on,created_by_account_id) VALUES ($1,'2026-10-10',$2)", [stock, owner]);

  const blankCard = async () => {
    const id = randomUUID();
    await admin.query("INSERT INTO cards(id,stock_purchase_id) VALUES ($1,$2)", [id, stock]);
    return id;
  };
  const actor = { actorId: owner };
  const provisionWithNfc = async () => {
    const cardId = await blankCard();
    const result = await provisionDbc(db, { ...actor, cardId, activationSecret: SECRET });
    await admin.query("UPDATE cards SET nfc_verified_at = now() WHERE id = $1", [cardId]);
    return { cardId, ...result };
  };

  // Session A holds the card's row lock; the service call must wait for it, then act on what A committed.
  const lockedScenario = async (
    cardId: string,
    call: () => Promise<unknown>,
    holderWork: (holder: pg.Client) => Promise<void>,
    expected: CardErrorCode,
  ) => {
    const holder = await connect();
    const { rows: [{ pid }] } = await holder.query("SELECT pg_backend_pid() AS pid");
    await holder.query("BEGIN");
    await holder.query("SELECT id FROM cards WHERE id = $1 FOR UPDATE", [cardId]);
    const pending = settle(call());
    let blocked = false;
    for (const deadline = Date.now() + 5000; !pending.state.done && !blocked && Date.now() < deadline; ) {
      const { rows: [row] } = await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))", [pid]);
      blocked = row.n > 0;
      if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert(blocked && !pending.state.done, "The service must wait for the card row lock");
    await holderWork(holder);
    await holder.query("COMMIT");
    await pending.finished;
    assert.equal((pending.state.error as { code?: string })?.code, expected, "The service must re-read state after acquiring the lock");
  };

  await check("provisionDbc waits for the card lock, then sees it was retired", async () => {
    const cardId = await blankCard();
    await lockedScenario(cardId, () => provisionDbc(db, { ...actor, cardId, activationSecret: SECRET }), async (h) => {
      await h.query("UPDATE cards SET state='retired' WHERE id=$1", [cardId]);
    }, "wrong_state");
  });

  await check("recordNfcCheck waits for the card lock, then sees it was retired", async () => {
    const { cardId, publicToken } = await (async () => {
      const id = await blankCard();
      const result = await provisionDbc(db, { ...actor, cardId: id, activationSecret: SECRET });
      return { cardId: id, publicToken: result.publicToken };
    })();
    await lockedScenario(cardId, () => recordNfcCheck(db, { ...actor, cardId, cardUrlOrigin: ORIGIN, readBackUri: `${ORIGIN}/c/${publicToken}`, readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true }), async (h) => {
      await h.query("UPDATE activation_credentials SET revoked_at=now() WHERE card_id=$1", [cardId]);
      await h.query("UPDATE cards SET state='retired' WHERE id=$1", [cardId]);
    }, "wrong_state");
  });

  await check("matchPackage waits for the card lock, then sees it was retired", async () => {
    const { cardId, activationCode } = await provisionWithNfc();
    await lockedScenario(cardId, () => matchPackage(db, { ...actor, cardId, activationCode, activationSecret: SECRET }), async (h) => {
      await h.query("UPDATE activation_credentials SET revoked_at=now() WHERE card_id=$1", [cardId]);
      await h.query("UPDATE cards SET state='retired' WHERE id=$1", [cardId]);
    }, "wrong_state");
  });

  await check("replaceProvisioningCredential waits for the card lock, then sees the credential was already replaced", async () => {
    const { cardId, credentialId } = await provisionWithNfc();
    await lockedScenario(cardId, () => replaceProvisioningCredential(db, { ...actor, cardId, credentialId, reason: "race", activationSecret: SECRET }), async (h) => {
      await h.query("UPDATE activation_credentials SET revoked_at=now() WHERE id=$1", [credentialId]);
      await h.query("INSERT INTO activation_credentials(card_id,lookup_hmac) VALUES ($1,$2)", [cardId, randomUUID().replaceAll("-", "").padEnd(64, "0")]);
    }, "credential_changed");
  });

  await check("retireCard waits for the card lock, then sees it was already retired", async () => {
    const cardId = await blankCard();
    await lockedScenario(cardId, () => retireCard(db, { ...actor, cardId, reason: "race" }), async (h) => {
      await h.query("UPDATE cards SET state='retired' WHERE id=$1", [cardId]);
    }, "wrong_state");
  });

  await check("a double provision of one card issues exactly one credential", async () => {
    const cardId = await blankCard();
    const results = await Promise.allSettled([1, 2].map(() => provisionDbc(db, { ...actor, cardId, activationSecret: SECRET })));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    assert.equal(rejected.reason.code, "already_provisioned");
    const { rows: [{ n }] } = await admin.query("SELECT count(*)::int AS n FROM activation_credentials WHERE card_id=$1", [cardId]);
    assert.equal(n, 1);
  });

  await check("two owners reserving the last GRC slot: exactly one wins", async () => {
    const order = randomUUID();
    const item = randomUUID();
    const purchaser = randomUUID();
    await admin.query("INSERT INTO purchasers(id,name) VALUES ($1,'Synthetic')", [purchaser]);
    await admin.query("INSERT INTO orders(id,purchaser_id,created_by_account_id,assigned_to_account_id) VALUES ($1,$2,$3,$3)", [order, purchaser, owner]);
    await admin.query("INSERT INTO order_items(id,order_id,product_id,product_kind,quantity,unit_price,review_url) VALUES ($1,$2,$3,'grc',1,100,'https://g.page/r/synthetic/review')", [item, order, grcProduct]);
    const [a, b] = [await blankCard(), await blankCard()];
    const results = await Promise.allSettled([a, b].map((cardId) => reserveGrc(db, { ...actor, cardId, orderItemId: item })));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason as { code: string }).code, "item_full");
    const { rows: [{ n }] } = await admin.query("SELECT count(*)::int AS n FROM cards WHERE order_item_id=$1 AND state='reserved'", [item]);
    assert.equal(n, 1);
  });

  assert.equal(failures.length, 0, `${failures.length} provisioning concurrency regressions failed`);
  console.log("All provisioning concurrency regressions passed.");
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  await Promise.all(clients.map((client) => client.end()));
}
