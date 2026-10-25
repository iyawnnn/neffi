// Real-PostgreSQL proof that a card can be claimed at most once. Disposable loopback database only (never Neon,
// never .env.local). PGlite cannot hold two sessions open, so concurrent claims and lock waits are proved here.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../src/db/schema";
import { claimCard, type ClaimResult } from "../src/modules/activation/claim";
import { issueActivationCredential } from "../src/modules/activation/credentials";

const url = new URL(process.env.DATABASE_URL_TEST ?? "");
assert.equal(url.hostname, "127.0.0.1", "Concurrency checks require a disposable loopback database");
assert.equal(url.pathname, "/neffi_m2_test");
assert(["postgres:", "postgresql:"].includes(url.protocol));
assert(![...url.searchParams.keys()].some((key) => ["host", "hostaddr", "port"].includes(key)));

const SECRET = "c".repeat(40);
const secrets = { lookupSecret: SECRET, activeKeyId: "test-v1", encryptionKeys: new Map([["test-v1", Buffer.alloc(32, 7)]]) };
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
  const pool = new pg.Pool({ connectionString: url.href, max: 2 });
  pools.push(pool);
  return drizzle({ client: pool, schema, casing: "snake_case" });
};
const settle = <T,>(promise: Promise<T>) => {
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
  const [dbA, dbB] = [database(), database()];
  await migrate(dbA, { migrationsFolder: "drizzle" });

  const [owner, a, b, product, stock, purchaser, order, item] = Array.from({ length: 8 }, () => randomUUID());
  await admin.query("INSERT INTO accounts(id,name,email) VALUES ($1,'Synthetic owner',$4),($2,'Synthetic A',$5),($3,'Synthetic B',$6)", [
    owner, a, b, `${owner}@example.test`, `${a}@example.test`, `${b}@example.test`,
  ]);
  // Inactive so it never disturbs the one-active-product-per-kind rule other checks rely on.
  await admin.query("INSERT INTO products(id,kind,name,price,active) VALUES ($1,'dbc','Synthetic DBC',100,false)", [product]);
  await admin.query("INSERT INTO stock_purchases(id,received_on,created_by_account_id) VALUES ($1,'2026-10-11',$2)", [stock, owner]);
  await admin.query("INSERT INTO purchasers(id,name) VALUES ($1,'Synthetic purchaser')", [purchaser]);
  await admin.query("INSERT INTO orders(id,purchaser_id,created_by_account_id,assigned_to_account_id) VALUES ($1,$2,$3,$3)", [order, purchaser, owner]);
  await admin.query("INSERT INTO order_items(id,order_id,product_id,product_kind,quantity,unit_price) VALUES ($1,$2,$3,'dbc',100,100)", [item, order, product]);

  const releasedCard = async () => {
    const cardId = randomUUID();
    const token = `CLAIM${randomUUID().replaceAll("-", "").slice(0, 21).toUpperCase()}`;
    await admin.query(
      "INSERT INTO cards(id,stock_purchase_id,product_id,kind,state,order_item_id,public_token) VALUES ($1,$2,$3,'dbc','released',$4,$5)",
      [cardId, stock, product, item, token],
    );
    const { credentialId } = await issueActivationCredential(dbA, cardId, secrets);
    return { cardId, credentialId };
  };
  const ownerOf = async (cardId: string) => (await admin.query("SELECT owner_account_id AS o FROM cards WHERE id=$1", [cardId])).rows[0].o;
  const claimEvents = async (cardId: string) =>
    (await admin.query("SELECT count(*)::int AS n FROM activity_events WHERE card_id=$1 AND type='card_claimed'", [cardId])).rows[0].n;

  // A holder session takes the card row lock; the claim must wait for it, then act on what the holder decided.
  const blockedClaim = async (cardId: string, credentialId: string, accountId: string, holderWork: (holder: pg.Client) => Promise<void>) => {
    const holder = await connect();
    const { rows: [{ pid }] } = await holder.query("SELECT pg_backend_pid() AS pid");
    await holder.query("BEGIN");
    await holder.query("SELECT id FROM cards WHERE id = $1 FOR UPDATE", [cardId]);
    const pending = settle(claimCard(dbA, { credentialId, accountId }));
    let blocked = false;
    for (const deadline = Date.now() + 5000; !pending.state.done && !blocked && Date.now() < deadline; ) {
      const { rows: [row] } = await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))", [pid]);
      blocked = row.n > 0;
      if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert(blocked && !pending.state.done, "The claim must wait for the card row lock");
    await holderWork(holder);
    await pending.finished;
    if (pending.state.error) throw pending.state.error;
    return pending.state.value as ClaimResult;
  };

  await check("two accounts claiming one card: exactly one wins", async () => {
    const { cardId, credentialId } = await releasedCard();
    const results = await Promise.all([claimCard(dbA, { credentialId, accountId: a }), claimCard(dbB, { credentialId, accountId: b })]);
    assert.deepEqual(results.map((r) => r.status).sort(), ["claimed", "unavailable"]);
    assert.equal(await ownerOf(cardId), results[0].status === "claimed" ? a : b);
    assert.equal(await claimEvents(cardId), 1);
    const { rows: [credential] } = await admin.query("SELECT used_at IS NOT NULL AS used, revoked_at IS NULL AS unrevoked FROM activation_credentials WHERE id=$1", [credentialId]);
    assert(credential.used && credential.unrevoked);
  });

  await check("one account submitting twice at once: one claim, one already-yours", async () => {
    const { cardId, credentialId } = await releasedCard();
    const results = await Promise.all([claimCard(dbA, { credentialId, accountId: a }), claimCard(dbB, { credentialId, accountId: a })]);
    assert.deepEqual(results.map((r) => r.status).sort(), ["already_yours", "claimed"]);
    assert.equal(await ownerOf(cardId), a);
    assert.equal(await claimEvents(cardId), 1);
  });

  await check("a claim waiting on the card lock sees a revocation committed meanwhile", async () => {
    const { cardId, credentialId } = await releasedCard();
    const result = await blockedClaim(cardId, credentialId, a, async (holder) => {
      await holder.query("UPDATE activation_credentials SET revoked_at = now() WHERE id = $1", [credentialId]);
      await holder.query("COMMIT");
    });
    assert.deepEqual(result, { status: "unavailable" });
    assert.equal(await ownerOf(cardId), null);
    assert.equal(await claimEvents(cardId), 0);
  });

  await check("a claim waiting behind a competing owner write that rolls back still wins", async () => {
    const { cardId, credentialId } = await releasedCard();
    const result = await blockedClaim(cardId, credentialId, a, async (holder) => {
      await holder.query("UPDATE cards SET owner_account_id = $2 WHERE id = $1", [cardId, b]);
      await holder.query("ROLLBACK");
    });
    assert.deepEqual(result, { status: "claimed", cardId });
    assert.equal(await ownerOf(cardId), a);
    assert.equal(await claimEvents(cardId), 1);
  });

  assert.equal(failures.length, 0, `${failures.length} claim concurrency checks failed`);
  console.log("All claim concurrency checks passed.");
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  await Promise.all(clients.map((client) => client.end()));
}
