import { sql } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { payments, products, refunds } from "./schema";
import { insertOrder, insertProduct } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test.each(["payments", "refunds"] as const)("%s void metadata is complete, reasoned and one-way while money remains frozen", (name) => rollback(db, async (tx) => {
  const { order, owner } = await insertOrder(tx);
  const shared = { orderId: order.id, amount: 100, method: "cash" as const, recordedByAccountId: owner.id };
  const [row] = name === "payments"
    ? await tx.insert(payments).values({ ...shared, paidOn: "2026-10-13" }).returning()
    : await tx.insert(refunds).values({ ...shared, refundedOn: "2026-10-13" }).returning();
  const table = sql.identifier(name);
  await expectPgError(tx, (s) => s.execute(sql`update ${table} set voided_at = now() where id = ${row.id}`), "23514", `${name}_void_all_or_none`);
  await expectPgError(tx, (s) => s.execute(sql`update ${table} set voided_at = now(), voided_by_account_id = ${owner.id}, void_reason = '  ' where id = ${row.id}`), "23514", `${name}_void_all_or_none`);
  await tx.execute(sql`update ${table} set voided_at = now(), voided_by_account_id = ${owner.id}, void_reason = 'Mis-keyed' where id = ${row.id}`);
  await tx.execute(sql`update ${table} set void_reason = void_reason where id = ${row.id}`);
  for (const change of [sql`void_reason = 'Changed'`, sql`voided_at = null, voided_by_account_id = null, void_reason = null`, sql`voided_by_account_id = ${crypto.randomUUID()}`, sql`voided_at = now() + interval '1 second'`]) {
    await expectPgError(tx, (s) => s.execute(sql`update ${table} set ${change} where id = ${row.id}`), "P0001");
  }
  await expectPgError(tx, (s) => s.execute(sql`update ${table} set amount = 200 where id = ${row.id}`), "P0001");
  await expectPgError(tx, (s) => s.execute(sql`delete from ${table} where id = ${row.id}`), "P0001");
  const { rows } = await tx.execute<{ amount: number; void_reason: string }>(sql`select amount, void_reason from ${table} where id = ${row.id}`);
  expect(rows[0]).toEqual({ amount: 100, void_reason: "Mis-keyed" });
}));

test.each(["dbc", "grc"] as const)("exactly one active %s product, inactive duplicates allowed", (kind) => rollback(db, async (tx) => {
  await insertProduct(tx, kind);
  await expectPgError(tx, (s) => s.insert(products).values({ kind, name: "Second active", price: 100 }), "23505", "products_one_active_per_kind");
  await tx.insert(products).values({ kind, name: "Historical", price: 100, active: false });
}));
