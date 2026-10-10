// Two-session regression on a disposable local PostgreSQL database; never reads .env.local.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL_TEST);
assert.equal(url.hostname, "127.0.0.1", "Concurrency checks require a disposable loopback database");
assert.equal(url.pathname, "/neffi_m2_test");
assert(["postgres:", "postgresql:"].includes(url.protocol));
assert(![...url.searchParams.keys()].some((key) => ["host", "hostaddr", "port"].includes(key)));
const connect = async () => {
  const client = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  await client.connect();
  await client.query("SET statement_timeout = '10s'");
  return client;
};
const clients = [];
const failures = [];
try {
  const admin = await connect(); clients.push(admin);
  const { rows: [server] } = await admin.query("SELECT current_setting('neon.project_id', true) AS neon");
  assert(!server.neon, "Concurrency checks must never target Neon");
  await migrate(drizzle({ client: admin }), { migrationsFolder: "drizzle" });
  const account = randomUUID(), product = randomUUID(), stock = randomUUID();
  await admin.query("INSERT INTO accounts(id,name,email) VALUES ($1,'Synthetic concurrency owner',$2)", [account, `${account}@example.test`]);
  await admin.query("INSERT INTO products(id,kind,name,price) VALUES ($1,'dbc','Synthetic concurrency DBC',100)", [product]);
  await admin.query("INSERT INTO stock_purchases(id,received_on,created_by_account_id) VALUES ($1,'2026-10-10',$2)", [stock, account]);
  const first = await connect(), second = await connect(); clients.push(first, second);
  const { rows: [{ pid: secondPid }] } = await second.query("SELECT pg_backend_pid() AS pid");
  for (const isolation of ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"]) {
    for (const retirementFirst of [true, false]) {
      const card = randomUUID();
      await admin.query("INSERT INTO cards(id,stock_purchase_id,product_id,kind,public_token) VALUES ($1,$2,$3,'dbc',$4)", [card, stock, product, `SYNTH-${card}`]);
      const retire = (client) => client.query("UPDATE cards SET state='retired' WHERE id=$1", [card]);
      const issue = (client) => client.query("INSERT INTO activation_credentials(card_id,lookup_hmac) VALUES ($1,$2)", [card, card.replaceAll("-", "").padEnd(64, "0")]);
      const label = `${isolation}: ${retirementFirst ? "retirement" : "issuance"} first`;
      try {
        await first.query(`BEGIN ISOLATION LEVEL ${isolation}`);
        await (retirementFirst ? retire : issue)(first);
        await second.query(`BEGIN ISOLATION LEVEL ${isolation}`);
        // Pin a snapshot before the first transaction commits, including for REPEATABLE READ.
        await second.query("SELECT state FROM cards WHERE id=$1", [card]);
        let settled = false;
        const pending = (retirementFirst ? issue : retire)(second).then(
          () => { settled = true; return { code: null }; },
          (error) => { settled = true; return { code: error.code }; },
        );
        let blocked = false;
        const deadline = Date.now() + 5000;
        while (!settled && !blocked && Date.now() < deadline) {
          const { rows: [locks] } = await admin.query("SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked", [secondPid]);
          blocked = locks.blocked;
          if (!blocked && !settled) await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert(blocked || settled, "Concurrent operation did not finish or acquire a lock");
        if (!blocked) await second.query("COMMIT");
        await first.query("COMMIT");
        const result = await pending;
        await second.query("ROLLBACK");
        const { rows: [{ count }] } = await admin.query(`SELECT count(*)::int AS count FROM cards c
          JOIN activation_credentials a ON a.card_id=c.id
          WHERE c.id=$1 AND c.state='retired' AND a.used_at IS NULL AND a.revoked_at IS NULL`, [card]);
        assert.equal(count, 0, "Concurrent transactions committed a retired card with a usable credential");
        assert(blocked, "Issuance and retirement must serialize on the referenced card");
        assert(["P0001", "40001"].includes(result.code), "The conflicting transaction must reject or retry");
        console.log(`PASS ${label}`);
      } catch (error) {
        failures.push(label);
        console.error(`FAIL ${label}: ${error instanceof assert.AssertionError ? error.message : "database error"}`);
      } finally {
        await first.query("ROLLBACK"); await second.query("ROLLBACK");
      }
    }
  }
  assert.equal(failures.length, 0, `${failures.length} concurrency regressions failed`);
  console.log("All six retirement/issuance concurrency regressions passed.");
} finally {
  await Promise.all(clients.map((client) => client.end()));
}
