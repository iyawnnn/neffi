import { eq } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { expenses, shipments, stockPurchases } from "@/db/schema";
import { insertOrder, insertStockPurchase } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";
import { saveExpense, deleteExpense } from "./manual";
import { expenseReport } from "./report";
let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });
test("unknown optional Order is a domain refusal and writes no expense", () => rollback(db, async (tx) => {
  const { owner } = await insertOrder(tx);
  await expect(saveExpense(tx, { actorId: owner.id, spentOn: "2026-10-13", amount: 500, category: "other", orderId: crypto.randomUUID() })).rejects.toMatchObject({ code: "not_found" });
  expect(await tx.select().from(expenses)).toEqual([]);
}));
test("manual entries create, edit and delete without altering derived costs", () => rollback(db, async (tx) => {
  const { owner, order } = await insertOrder(tx);
  const id = await saveExpense(tx, { actorId: owner.id, spentOn: "2026-10-13", amount: 500, category: "other", orderId: order.id });
  await saveExpense(tx, { actorId: owner.id, id, spentOn: "2026-10-12", amount: 700, category: "marketing", payee: "Printer" });
  expect(await tx.select().from(expenses)).toMatchObject([{ id, amount: 700, category: "marketing", payee: "Printer" }]);
  await deleteExpense(tx, id);
  expect(await tx.select().from(expenses)).toEqual([]);
}));
test("monthly UNION assigns source dates/categories and counts each cost once", () => rollback(db, async (tx) => {
  const { owner, order } = await insertOrder(tx);
  const stock = await insertStockPurchase(tx);
  await tx.update(stockPurchases).set({ purchaseCost: 1000, inboundShippingCost: 200 }).where(eq(stockPurchases.id, stock.id));
  await tx.insert(shipments).values([{ orderId: order.id, status: "in_transit", shippedOn: "2026-10-12", courierCost: 300 }, { orderId: order.id, status: "in_transit", shippedOn: "2026-09-30", courierCost: 999 }]);
  await saveExpense(tx, { actorId: owner.id, spentOn: "2026-10-13", amount: 400, category: "marketing" });
  const report = await expenseReport(tx, "2026-10");
  expect(report.total).toBe(1900);
  expect(report.categories).toMatchObject({ inventory_production: 1000, shipping_delivery: 500, marketing: 400 });
  expect(report.rows).toHaveLength(4);
  expect(report.rows.filter((row) => row.source === "courier")).toMatchObject([{ spentOn: "2026-10-12", amount: 300, orderId: order.id }]);
  expect(await tx.select().from(expenses)).toHaveLength(1);
}));
