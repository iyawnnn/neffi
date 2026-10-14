import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { refunds, supportCases, supportCaseCards } from "./schema";
import { insertOrder, insertReleasedDbc } from "./test-fixtures";
import { createTestDb, expectPgError, rollback, type TestDb } from "./testing";

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("refund sale/support classification is immutable in both directions", () => rollback(db, async (tx) => {
  const { order, owner } = await insertOrder(tx);
  const [support] = await tx.insert(supportCases).values({ type: "other", summary: "Correction", orderId: order.id }).returning();
  for (const supportCaseId of [null, support.id]) {
    const [refund] = await tx.insert(refunds).values({ orderId: order.id, amount: 100, method: "cash", refundedOn: "2026-10-14", recordedByAccountId: owner.id, supportCaseId, reason: "Correction" }).returning();
    await expectPgError(tx, (s) => s.update(refunds).set({ supportCaseId: supportCaseId ? null : support.id }).where(eq(refunds.id, refund.id)), "P0001");
    await expectPgError(tx, (s) => s.update(refunds).set({ amount: 200 }).where(eq(refunds.id, refund.id)), "P0001");
    await tx.update(refunds).set({ voidedAt: new Date(), voidedByAccountId: owner.id, voidReason: "Typo" }).where(eq(refunds.id, refund.id));
    await expectPgError(tx, (s) => s.update(refunds).set({ voidedAt: null, voidedByAccountId: null, voidReason: null }).where(eq(refunds.id, refund.id)), "P0001");
  }
}));

test("support refunds require a reason while sale refunds do not", () => rollback(db, async (tx) => {
  const { order, owner } = await insertOrder(tx);
  const [support] = await tx.insert(supportCases).values({ type: "other", summary: "Correction" }).returning();
  const row = { orderId: order.id, amount: 100, method: "cash" as const, refundedOn: "2026-10-14", recordedByAccountId: owner.id };
  for (const reason of [null, "", "   "]) {
    await expectPgError(tx, (s) => s.insert(refunds).values({ ...row, supportCaseId: support.id, reason }), "23514", "refunds_support_reason");
  }
  await tx.insert(refunds).values(row);
  expect(await tx.select().from(refunds)).toHaveLength(1);
}));

test("case-card links cannot be rewritten or removed", () => rollback(db, async (tx) => {
  const { card } = await insertReleasedDbc(tx);
  const [support] = await tx.insert(supportCases).values({ type: "other", summary: "Correction" }).returning();
  await tx.insert(supportCaseCards).values({ supportCaseId: support.id, cardId: card.id, role: "affected" });
  await expectPgError(tx, (s) => s.update(supportCaseCards).set({ role: "replacement" }), "P0001");
  await expectPgError(tx, (s) => s.delete(supportCaseCards), "P0001");
}));
