// Local development only: creates synthetic sold-but-unclaimed Digital Business Cards plus the unavailable cases, and
// prints their activation codes for browser acceptance of /activate. Loopback databases only; never Neon, never
// .env.local. Printing codes is acceptable here because they exist only in this disposable database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../src/db/schema";
import { formatActivationCode } from "../src/modules/activation/code";
import { issueActivationCredential } from "../src/modules/activation/credentials";

const url = new URL(process.env.DATABASE_URL ?? "");
assert(["127.0.0.1", "localhost"].includes(url.hostname), "The activation fixture only runs against a loopback database");
assert(["postgres:", "postgresql:"].includes(url.protocol));
assert(![...url.searchParams.keys()].some((key) => ["host", "hostaddr", "port"].includes(key)));
const secret = process.env.ACTIVATION_CODE_SECRET ?? "";
assert(secret.length >= 32, "Set ACTIVATION_CODE_SECRET to the dev server's value");

const pool = new pg.Pool({ connectionString: url.href, max: 2 });
try {
  const { rows: [server] } = await pool.query("SELECT current_setting('neon.project_id', true) AS neon");
  assert(!server.neon, "The activation fixture must never target Neon");
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "drizzle" });

  const [owner, earlierBuyer, purchaser, order, item, stock] = Array.from({ length: 6 }, () => randomUUID());
  const existing = (await pool.query("SELECT id FROM products WHERE kind = 'dbc' AND active LIMIT 1")).rows[0]?.id as string | undefined;
  const product = existing ?? randomUUID();
  if (!existing) await pool.query("INSERT INTO products(id,kind,name,price) VALUES ($1,'dbc','Synthetic DBC',50000)", [product]);
  await pool.query("INSERT INTO accounts(id,name,email) VALUES ($1,'Synthetic fixture owner',$3),($2,'Synthetic earlier buyer',$4)", [
    owner, earlierBuyer, `${owner}@example.test`, `${earlierBuyer}@example.test`,
  ]);
  await pool.query("INSERT INTO stock_purchases(id,received_on,created_by_account_id) VALUES ($1,'2026-10-11',$2)", [stock, owner]);
  await pool.query("INSERT INTO purchasers(id,name) VALUES ($1,'Synthetic purchaser')", [purchaser]);
  await pool.query("INSERT INTO orders(id,purchaser_id,created_by_account_id,assigned_to_account_id) VALUES ($1,$2,$3,$3)", [order, purchaser, owner]);
  await pool.query("INSERT INTO order_items(id,order_id,product_id,product_kind,quantity,unit_price) VALUES ($1,$2,$3,'dbc',10,50000)", [item, order, product]);

  const card = async (state: "released" | "blank", ownerId: string | null = null) => {
    const id = randomUUID();
    const token = `DEVACT${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
    await pool.query(
      "INSERT INTO cards(id,stock_purchase_id,product_id,kind,state,order_item_id,public_token,owner_account_id) VALUES ($1,$2,$3,'dbc',$4,$5,$6,$7)",
      [id, stock, product, state, state === "released" ? item : null, token, ownerId],
    );
    return { id, suffix: token.slice(-4) };
  };
  const issue = async (cardId: string) => formatActivationCode((await issueActivationCredential(db, cardId, secret)).code);
  const rows: { scenario: string; code: string; card: string }[] = [];

  for (const n of [1, 2, 3]) {
    const c = await card("released");
    rows.push({ scenario: `claimable ${n}`, code: await issue(c.id), card: `…${c.suffix}` });
  }
  {
    const c = await card("released");
    const revoked = await issue(c.id);
    await pool.query("UPDATE activation_credentials SET revoked_at = now() WHERE card_id = $1 AND used_at IS NULL AND revoked_at IS NULL", [c.id]);
    rows.push({ scenario: "revoked (unavailable)", code: revoked, card: `…${c.suffix}` });
    rows.push({ scenario: "replacement for that card (claimable)", code: await issue(c.id), card: `…${c.suffix}` });
  }
  {
    const c = await card("blank");
    const code = await issue(c.id);
    await pool.query("UPDATE cards SET state = 'ready', nfc_verified_at = now(), package_matched_at = now() WHERE id = $1", [c.id]);
    rows.push({ scenario: "unsold Ready card (unavailable)", code, card: `…${c.suffix}` });
  }
  {
    const c = await card("released", earlierBuyer);
    const code = await issue(c.id);
    await pool.query("UPDATE activation_credentials SET used_at = now() WHERE card_id = $1 AND used_at IS NULL AND revoked_at IS NULL", [c.id]);
    rows.push({ scenario: "used by another account (unavailable)", code, card: `…${c.suffix}` });
  }
  console.table(rows);
} finally {
  await pool.end();
}
