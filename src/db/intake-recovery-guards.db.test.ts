import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import * as s from "./schema";
import { insertAccount } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("public contact checks and immutable intake fields preserve case deletion", () => rollback(db, async tx => {
  const values = { type: "other" as const, summary: "Other", source: "public" as const, requesterEmail: "contact@example.test", clientKey: crypto.randomUUID() };
  await expectPgError(tx, t => t.insert(s.supportCases).values({ ...values, requesterEmail: null }), "23514");
  await expectPgError(tx, t => t.insert(s.supportCases).values({ ...values, requesterEmail: "UPPER@example.test" }), "23514");
  await expectPgError(tx, t => t.insert(s.supportCases).values({ ...values, requesterMessage: "x".repeat(2001) }), "23514");
  const [row] = await tx.insert(s.supportCases).values(values).returning();
  await expectPgError(tx, t => t.insert(s.supportCases).values(values), "23505");
  for (const change of [{ source: "owner" as const }, { requesterEmail: "other@example.test" }, { requesterName: "Changed" }, { requesterMessage: "Changed" }, { clientKey: crypto.randomUUID() }, { createdAt: new Date(0) }]) await expectPgError(tx, t => t.update(s.supportCases).set(change).where(eq(s.supportCases.id, row.id)), "P0001");
  await tx.delete(s.supportCases).where(eq(s.supportCases.id, row.id));
  expect(await tx.select().from(s.supportCases)).toHaveLength(0);
  const indexes = await tx.execute(sql`select indexdef from pg_indexes where indexname = 'support_cases_public_ack_idx'`);
  expect(indexes.rows).toHaveLength(1);
}));

test("recoveries enforce pending uniqueness, frozen proof and one-way terminal history", () => rollback(db, async tx => {
  const owner = await insertAccount(tx, "owner");
  const account = await insertAccount(tx);
  const [support] = await tx.insert(s.supportCases).values({ type: "account_recovery", summary: "Recovery", accountId: account.id }).returning();
  const values = { supportCaseId: support.id, accountId: account.id, oldEmail: account.email, newEmail: "new@example.test", codeHmac: "a".repeat(64), expiresAt: new Date(Date.now() + 100000), createdByAccountId: owner.id };
  await expectPgError(tx, t => t.insert(s.accountRecoveries).values({ ...values, codeHmac: "raw" }), "23514");
  const [row] = await tx.insert(s.accountRecoveries).values(values).returning();
  await expectPgError(tx, t => t.insert(s.accountRecoveries).values({ ...values, newEmail: "other@example.test" }), "23505");
  const second = await insertAccount(tx);
  await expectPgError(tx, t => t.insert(s.accountRecoveries).values({ ...values, accountId: second.id }), "23505");
  for (const change of [{ codeHmac: "b".repeat(64) }, { oldEmail: "changed@example.test" }, { newEmail: "changed@example.test" }, { accountId: second.id }, { supportCaseId: crypto.randomUUID() }, { createdAt: new Date(0) }]) await expectPgError(tx, t => t.update(s.accountRecoveries).set(change).where(eq(s.accountRecoveries.id, row.id)), "P0001");
  await tx.update(s.accountRecoveries).set({ attempts: 1 }).where(eq(s.accountRecoveries.id, row.id));
  await expectPgError(tx, t => t.update(s.accountRecoveries).set({ attempts: 0 }).where(eq(s.accountRecoveries.id, row.id)), "P0001");
  await tx.update(s.accountRecoveries).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(s.accountRecoveries.id, row.id));
  await expectPgError(tx, t => t.update(s.accountRecoveries).set({ status: "pending" }).where(eq(s.accountRecoveries.id, row.id)), "P0001");
  await expectPgError(tx, t => t.update(s.accountRecoveries).set({ attempts: 2 }).where(eq(s.accountRecoveries.id, row.id)), "P0001");
  await expectPgError(tx, t => t.delete(s.accountRecoveries).where(eq(s.accountRecoveries.id, row.id)), "P0001");
  await tx.insert(s.accountRecoveries).values(values);
}));
