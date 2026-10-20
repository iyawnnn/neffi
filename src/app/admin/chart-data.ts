import type { DailyCollected, DailyOrders } from "@/modules/orders/trends";

// Pure shaping of real rows into one point per calendar day of a month, so the charts have no gaps to invent.
// Dates are plain "YYYY-MM-DD" strings (the Manila business day) and are only ever formatted in UTC.

export type MonthDay = { day: string; short: string; medium: string; long: string };

const shortFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const mediumFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const longFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric" });

/** Every day of `month` ("YYYY-MM") with a short ("Oct 14"), medium ("Oct 14, 2026") and long ("October 14") label. */
export function monthDays(month: string): MonthDay[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, index + 1));
    return { day: `${month}-${String(index + 1).padStart(2, "0")}`, short: shortFormat.format(date), medium: mediumFormat.format(date), long: longFormat.format(date) };
  });
}

export type CashFlowPoint = MonthDay & { collected: number; expenses: number; surplus: number };

/** Collected (payments minus refunds) against expenses, per day, and their difference (a cash surplus, not profit). Collected may dip below zero on a refund day. */
export function cashFlowPoints(month: string, collected: DailyCollected[], expenses: { spentOn: string; amount: number }[]): CashFlowPoint[] {
  return monthDays(month).map((entry) => {
    const received = collected.filter((row) => row.day === entry.day).reduce((sum, row) => sum + row.amount, 0);
    const spent = expenses.filter((row) => row.spentOn === entry.day).reduce((sum, row) => sum + row.amount, 0);
    return { ...entry, collected: received, expenses: spent, surplus: received - spent };
  });
}

export type DayAmount = MonthDay & { amount: number };

export function expensePoints(month: string, expenses: { spentOn: string; amount: number }[]): DayAmount[] {
  return monthDays(month).map((entry) => ({ ...entry, amount: expenses.filter((row) => row.spentOn === entry.day).reduce((sum, row) => sum + row.amount, 0) }));
}

export type OrderPoint = MonthDay & { in_progress: number; completed: number; cancelled: number };

export function orderPoints(month: string, orders: DailyOrders[]): OrderPoint[] {
  return monthDays(month).map((entry) => {
    const count = (status: DailyOrders["status"]) => orders.filter((row) => row.day === entry.day && row.status === status).reduce((sum, row) => sum + row.count, 0);
    return { ...entry, in_progress: count("in_progress"), completed: count("completed"), cancelled: count("cancelled") };
  });
}

/** True when a series has anything worth drawing; the pages show a plain empty state otherwise. */
export const hasData = (points: object[], keys: string[]) => points.some((point) => keys.some((key) => (point as Record<string, unknown>)[key] !== 0 && typeof (point as Record<string, unknown>)[key] === "number"));

export type CategorySlice = { key: string; label: string; amount: number };

/** The largest `keep` categories as they are, the rest folded into one "Other" slice. Display only: stored categories never change. */
export function groupCategories(rows: CategorySlice[], keep = 5): CategorySlice[] {
  const ranked = rows.filter((row) => row.amount > 0).sort((a, b) => b.amount - a.amount);
  if (ranked.length <= keep + 1) return ranked;
  const shown = ranked.slice(0, keep);
  const rest = ranked.slice(keep);
  return [...shown, { key: "grouped_other", label: shown.some((row) => row.label === "Other") ? "Other categories" : "Other", amount: rest.reduce((sum, row) => sum + row.amount, 0) }];
}
