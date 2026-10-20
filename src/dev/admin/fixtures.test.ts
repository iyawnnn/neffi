import { expect, test } from "vitest";
import { cashFlowPoints, expensePoints, orderPoints } from "@/app/admin/chart-data";
import { accounts, cards, cases, counts, dashboardData, expenses, filterCards, filterOrders, fixturePage, MONTH, orders, purchasers, purchases, report, searchFixtures, trends } from "./fixtures";

test("October fixtures have fixed counts, valid states, repeat buyers and useful edge cases", () => {
  expect([orders.length, purchasers.length, accounts.length, cards.length, expenses.length, cases.length]).toEqual([102, 43, 43, 63, 32, 23]);
  expect(orders.every((row) => row.createdAt.toISOString().startsWith(MONTH))).toBe(true);
  expect(new Set(orders.map((row) => row.status))).toEqual(new Set(["completed", "in_progress", "cancelled"]));
  expect(new Set(orders.map((row) => row.productKind))).toEqual(new Set(["dbc", "grc"]));
  expect(new Set(orders.map((row) => row.deliveryMethod))).toEqual(new Set(["pickup", "courier", "local_handoff"]));
  expect(purchasers.some((row) => row.name.length > 70)).toBe(true);
  expect(purchasers.some((row) => row.cardCount === 0)).toBe(true);
  expect(purchasers.some((row) => row.orderCount > 2)).toBe(true);
  expect(orders.some((row) => row.balance > 0 && row.balance < row.orderTotal)).toBe(true);
  expect(orders.some((row) => row.orderTotal >= 2_000_000)).toBe(true);
  expect(counts.rows.reduce((sum, row) => sum + row.count, 0)).toBe(cards.length);
  expect(counts.inProvisioning).toBeGreaterThan(0);
  expect(new Set(cards.map((row) => row.state)).size).toBe(5);
  expect(accounts.every((row) => row.email.endsWith("@example.invalid"))).toBe(true);
});

test("financial figures, daily charts and category shares come from the same fixture rows", () => {
  const collected = orders.reduce((sum, row) => sum + row.collected, 0);
  const spent = expenses.reduce((sum, row) => sum + row.amount, 0);
  expect(dashboardData.collected).toBe(collected);
  expect(dashboardData.outstanding).toBe(orders.filter((row) => row.status !== "cancelled").reduce((sum, row) => sum + row.balance, 0));
  expect(dashboardData.expenses).toBe(spent);
  expect(report.total).toBe(spent);
  expect(Object.values(report.categories).reduce((sum, amount) => sum + amount, 0)).toBe(spent);
  expect(Object.keys(report.categories)).toEqual(["inventory_production", "packaging_printing", "shipping_delivery", "software_operations", "marketing", "other"]);
  expect(Math.max(...Object.values(report.categories)) / spent).toBeLessThan(0.45);
  const cash = cashFlowPoints(MONTH, trends.collected, expenses);
  expect(cash).toHaveLength(31);
  expect(cash.reduce((sum, point) => sum + point.collected, 0)).toBe(collected);
  expect(cash.reduce((sum, point) => sum + point.expenses, 0)).toBe(spent);
  expect(cash.reduce((sum, point) => sum + point.surplus, 0)).toBe(collected - spent);
  expect(cash.filter((point) => point.collected > 0).length).toBeGreaterThan(20);
  expect(cash.some((point) => point.collected === 0 && point.expenses === 0)).toBe(true);
  expect(orderPoints(MONTH, trends.orders).reduce((sum, point) => sum + point.completed + point.cancelled + point.in_progress, 0)).toBe(orders.length);
  expect(expensePoints(MONTH, expenses).reduce((sum, point) => sum + point.amount, 0)).toBe(spent);
});

test.each([["inventory", cards, 10, 7, 3], ["orders", orders, 20, 6, 2], ["customers", purchasers, 20, 3, 3], ["accounts", accounts, 20, 3, 3], ["support", cases, 20, 2, 3]] as const)("%s uses real totals with first, middle and partial last pages", (_name, rows, size, pages, lastCount) => {
  const first = fixturePage<unknown>(rows, "1", size);
  const middle = fixturePage<unknown>(rows, "2", size);
  const last = fixturePage<unknown>(rows, String(pages), size);
  expect(first.window.pageCount).toBe(pages);
  expect(first.window.total).toBe(rows.length);
  expect(first.rows).toHaveLength(size);
  expect(middle.rows).not.toEqual(first.rows);
  expect(last.rows).toHaveLength(lastCount);
  expect(fixturePage<unknown>(rows, "invalid", size).window.page).toBe(1);
  expect(fixturePage<unknown>(rows, "-2", size).window.page).toBe(1);
  expect(fixturePage<unknown>(rows, "999", size).rows).toEqual(last.rows);
});

test("filters precede paging and search covers all requested record examples", () => {
  const rows = filterCards({ kind: "dbc", state: "ready" });
  expect(fixturePage(rows, undefined, 10).window.page).toBe(1);
  expect(rows.every((row) => row.kind === "dbc" && row.state === "ready")).toBe(true);
  expect(filterOrders({ status: "cancelled" }).every((row) => row.status === "cancelled")).toBe(true);
  for (const query of ["260001", "Juan Dela Cruz", "sample.01@example.invalid", "09XX", "0002", "TEST-001"]) expect(searchFixtures(query).length, query).toBeGreaterThan(0);
  expect(fixturePage(searchFixtures("sample"), "3").window.pageCount).toBeGreaterThan(2);
  expect(searchFixtures("s")).toEqual([]);
});

test("delivery quantities and costs come from the same cards and expense rows", () => {
  expect(purchases).toHaveLength(4);
  expect(purchases.reduce((sum, row) => sum + row.quantity, 0)).toBe(cards.length);
  for (const purchase of purchases) {
    expect(purchase.quantity).toBe(cards.filter((card) => card.stockPurchaseId === purchase.id).length);
    expect(purchase.purchaseCost).toBe(expenses.find((row) => row.source === "stock" && row.id === purchase.id)?.amount);
    expect(purchase.inboundShippingCost).toBe(expenses.find((row) => row.source === "inbound" && row.id === purchase.id)?.amount);
  }
});
