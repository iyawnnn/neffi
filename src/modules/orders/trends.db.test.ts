import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { orders, payments, refunds } from "@/db/schema";
import { insertOrderItem } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { dashboard } from "./dashboard";
import { monthTrends } from "./trends";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("daily collected adds up to the dashboard's Collected figure and skips voided money", () => rollback(db, async (tx) => {
  const { order, owner } = await insertOrderItem(tx, "dbc", 2);
  await tx.insert(payments).values([
    { orderId: order.id, amount: 20000, method: "cash", paidOn: "2026-10-02", recordedByAccountId: owner.id },
    { orderId: order.id, amount: 3000, method: "gcash", paidOn: "2026-10-02", recordedByAccountId: owner.id },
    { orderId: order.id, amount: 10000, method: "cash", paidOn: "2026-09-30", recordedByAccountId: owner.id },
    { orderId: order.id, amount: 999, method: "cash", paidOn: "2026-10-04", recordedByAccountId: owner.id, voidedAt: new Date(), voidedByAccountId: owner.id, voidReason: "Typo" },
  ]);
  await tx.insert(refunds).values({ orderId: order.id, amount: 5000, method: "cash", refundedOn: "2026-10-03", recordedByAccountId: owner.id });
  const { collected } = await monthTrends(tx, "2026-10");
  expect(collected).toEqual([{ day: "2026-10-02", amount: 23000 }, { day: "2026-10-03", amount: -5000 }]);
  expect(collected.reduce((sum, row) => sum + row.amount, 0)).toBe((await dashboard(tx, "2026-10")).collected);
}));

test("orders are counted per Manila day and status, inside the month only", () => rollback(db, async (tx) => {
  const { order } = await insertOrderItem(tx, "dbc");
  // 2026-10-31 17:30 UTC is already 1 November in Manila.
  await tx.update(orders).set({ createdAt: new Date("2026-10-31T17:30:00Z") }).where(eq(orders.id, order.id));
  expect((await monthTrends(tx, "2026-10")).orders).toEqual([]);
  expect((await monthTrends(tx, "2026-11")).orders).toEqual([{ day: "2026-11-01", status: "in_progress", count: 1 }]);
  await expect(monthTrends(tx, "2026-13")).rejects.toThrow(RangeError);
}));
