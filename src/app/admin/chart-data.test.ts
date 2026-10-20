import { expect, test } from "vitest";
import { cashFlowPoints, expensePoints, groupCategories, hasData, monthDays, orderPoints } from "./chart-data";

test("monthDays covers every calendar day, including leap February", () => {
  expect(monthDays("2026-10")).toHaveLength(31);
  expect(monthDays("2026-10")[13]).toEqual({ day: "2026-10-14", short: "Oct 14", medium: "Oct 14, 2026", long: "October 14" });
  expect(monthDays("2028-02")).toHaveLength(29);
  expect(monthDays("2026-02")).toHaveLength(28);
});

test("cash flow keeps real rows on their day and leaves the rest at zero", () => {
  const points = cashFlowPoints("2026-10", [{ day: "2026-10-02", amount: 23000 }, { day: "2026-10-03", amount: -5000 }], [{ spentOn: "2026-10-02", amount: 700 }, { spentOn: "2026-10-02", amount: 300 }, { spentOn: "2026-09-30", amount: 999 }]);
  expect(points[1]).toMatchObject({ day: "2026-10-02", collected: 23000, expenses: 1000, surplus: 22000 });
  expect(points[2]).toMatchObject({ collected: -5000, expenses: 0, surplus: -5000 });
  expect(points.reduce((sum, point) => sum + point.expenses, 0)).toBe(1000);
  expect(hasData(points, ["collected", "expenses"])).toBe(true);
  expect(hasData(cashFlowPoints("2026-10", [], []), ["collected", "expenses"])).toBe(false);
});

test("order and expense points sum per day and status", () => {
  const orders = orderPoints("2026-10", [{ day: "2026-10-05", status: "completed", count: 2 }, { day: "2026-10-05", status: "in_progress", count: 1 }]);
  expect(orders[4]).toMatchObject({ completed: 2, in_progress: 1, cancelled: 0 });
  expect(expensePoints("2026-10", [{ spentOn: "2026-10-31", amount: 5 }])[30].amount).toBe(5);
});

test("category slices keep the top five and fold the rest into one Other slice without touching the data", () => {
  const rows = ["a", "b", "c", "d", "e", "f", "g", "h"].map((key, index) => ({ key, label: key.toUpperCase(), amount: (8 - index) * 100 }));
  const grouped = groupCategories(rows);
  expect(grouped.map((slice) => slice.label)).toEqual(["A", "B", "C", "D", "E", "Other"]);
  expect(grouped.at(-1)?.amount).toBe(300 + 200 + 100);
  expect(grouped.reduce((sum, slice) => sum + slice.amount, 0)).toBe(rows.reduce((sum, row) => sum + row.amount, 0));
  expect(rows).toHaveLength(8);
  expect(groupCategories(rows.slice(0, 6))).toHaveLength(6);
  expect(groupCategories([{ key: "x", label: "X", amount: 0 }, { key: "y", label: "Y", amount: 5 }])).toEqual([{ key: "y", label: "Y", amount: 5 }]);
  const clash = groupCategories([...rows.slice(0, 4), { key: "other", label: "Other", amount: 500 }, ...rows.slice(4, 8)].map((row, index) => ({ ...row, amount: 1000 - index })));
  expect(clash.filter((slice) => slice.label === "Other")).toHaveLength(1);
});
