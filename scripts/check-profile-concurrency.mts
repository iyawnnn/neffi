// Real PostgreSQL proof for customer setup, block ordering and message deduplication. Loopback only; never .env.local.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../src/db/schema";
import { randomCrockford } from "../src/lib/crockford";
import { submitForm } from "../src/modules/forms/submissions";
import { addBlock, moveBlock } from "../src/modules/profiles/blocks";
import { createProfileFromStarter, publishProfile } from "../src/modules/profiles/profiles";

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

  const [owner, customer, product, stock, purchaser, order, item] = Array.from({ length: 7 }, () => randomUUID());
  await admin.query("INSERT INTO accounts(id,name,email) VALUES ($1,'Synthetic owner',$3),($2,'Synthetic customer',$4)", [owner, customer, `${owner}@example.test`, `${customer}@example.test`]);
  await admin.query("INSERT INTO products(id,kind,name,price,active) VALUES ($1,'dbc','Synthetic DBC',100,false)", [product]);
  await admin.query("INSERT INTO stock_purchases(id,received_on,created_by_account_id) VALUES ($1,'2026-10-11',$2)", [stock, owner]);
  await admin.query("INSERT INTO purchasers(id,name) VALUES ($1,'Synthetic purchaser')", [purchaser]);
  await admin.query("INSERT INTO orders(id,purchaser_id,created_by_account_id,assigned_to_account_id) VALUES ($1,$2,$3,$3)", [order, purchaser, owner]);
  await admin.query("INSERT INTO order_items(id,order_id,product_id,product_kind,quantity,unit_price) VALUES ($1,$2,$3,'dbc',100,100)", [item, order, product]);

  const ownedReleasedCard = async () => {
    const cardId = randomUUID();
    await admin.query("INSERT INTO cards(id,stock_purchase_id,product_id,kind,state,order_item_id,public_token,owner_account_id) VALUES ($1,$2,$3,'dbc','released',$4,$5,$6)", [cardId, stock, product, item, randomCrockford(26), customer]);
    return cardId;
  };
  let profileId: string;
  let sceneId: string;
  const blocks = async () => (await admin.query("SELECT id,position FROM scene_blocks WHERE scene_id=$1 ORDER BY position", [sceneId])).rows as { id: string; position: number }[];
  const assertDense = async () => {
    const positions = (await blocks()).map(block => block.position);
    assert.deepEqual(positions, Array.from({ length: positions.length }, (_, i) => i));
    assert.equal(new Set(positions).size, positions.length);
  };

  await check("two setups for one card create one profile", async () => {
    const cardId = await ownedReleasedCard();
    const input = { accountId: customer, cardId, purpose: "network" as const, essentials: { fullName: "Synthetic customer", headline: null, bio: null, email: "customer@example.test", phone: null, link: null } };
    const pending = settle(Promise.all([createProfileFromStarter(dbA, input), createProfileFromStarter(dbB, input)]));
    await pending.finished;
    if (pending.state.error) throw pending.state.error;
    const results = pending.state.value!;
    assert.deepEqual(results.map(result => result.created).sort(), [false, true]);
    assert.equal(results[0].profileId, results[1].profileId);
    profileId = results[0].profileId;
    const { rows: [profile] } = await admin.query("SELECT default_scene_id FROM profiles WHERE id=$1", [profileId]);
    sceneId = profile.default_scene_id;
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM profiles WHERE account_id=$1", [customer])).rows[0].n, 1);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM activity_events WHERE card_id=$1 AND type='card_profile_changed'", [cardId])).rows[0].n, 1);
  });

  await check("concurrent adds keep positions dense and unique", async () => {
    const before = (await blocks()).length;
    await Promise.all(Array.from({ length: 6 }, (_, i) => addBlock(i % 2 ? dbA : dbB, { accountId: customer, profileId, sceneId, type: "link", content: { kind: "custom", label: `Link ${i}`, url: "https://example.test/" } })));
    assert.equal((await blocks()).length, before + 6);
    await assertDense();
  });

  await check("moves racing with adds keep a permutation", async () => {
    const before = await blocks();
    await Promise.all([
      ...before.slice(0, 4).map((block, i) => moveBlock(i % 2 ? dbA : dbB, { accountId: customer, profileId, blockId: block.id, direction: i % 2 ? "up" : "down" })),
      ...Array.from({ length: 3 }, (_, i) => addBlock(i % 2 ? dbA : dbB, { accountId: customer, profileId, sceneId, type: "link", content: { kind: "custom", label: `Added ${i}`, url: "https://example.test/" } })),
    ]);
    const after = await blocks();
    assert.equal(after.length, before.length + 3);
    assert(before.every(block => after.some(row => row.id === block.id)));
    await assertDense();
  });

  await check("the same browser key stores one message", async () => {
    await publishProfile(dbA, { accountId: customer, profileId });
    const { rows: [form] } = await admin.query("SELECT id FROM form_definitions WHERE profile_id=$1", [profileId]);
    const input = { formId: form.id, clientKey: randomUUID(), answers: { name: "Synthetic Visitor", email: "visitor@example.test", message: "Synthetic message" } };
    const results = await Promise.all([submitForm(dbA, input), submitForm(dbB, input)]);
    assert.deepEqual(results.map(result => result.status).sort(), ["created", "duplicate"]);
    assert(results[0].status === "created" || results[0].status === "duplicate");
    assert(results[1].status === "created" || results[1].status === "duplicate");
    assert.equal(results[0].submissionId, results[1].submissionId);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM form_submissions WHERE form_id=$1 AND client_key=$2", [form.id, input.clientKey])).rows[0].n, 1);
  });

  assert.equal(failures.length, 0, `${failures.length} profile concurrency checks failed`);
  console.log("All profile concurrency checks passed.");
} finally {
  await Promise.all(pools.map((pool) => pool.end()));
  await Promise.all(clients.map((client) => client.end()));
}
