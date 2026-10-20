import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "../db";

// Read-only daily series for the dashboard charts. Money mirrors `dashboard()`: payments minus refunds on the day
// they were recorded, voided entries excluded, so the days always add up to the month's Collected figure.

export type DailyCollected = { day: string; amount: number };
export type DailyOrders = { day: string; status: "in_progress" | "completed" | "cancelled"; count: number };

export async function monthTrends(db: Db, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError("Choose a valid month");
  const start = `${month}-01`;
  const [money, orders] = await Promise.all([
    db.execute(sql`
      SELECT day, sum(amount)::float8 AS amount FROM (
        SELECT paid_on::text AS day, amount FROM payments WHERE voided_at IS NULL
        UNION ALL SELECT refunded_on::text, -amount FROM refunds WHERE voided_at IS NULL
      ) movements WHERE day >= ${start} AND day < (${start}::date + INTERVAL '1 month')::date::text GROUP BY day ORDER BY day
    `),
    // Orders are bucketed by the Manila calendar day they were created, the same clock the dashboard month uses.
    db.execute(sql`
      SELECT (created_at AT TIME ZONE 'Asia/Manila')::date::text AS day, status::text AS status, count(*)::int AS count FROM orders
      WHERE (created_at AT TIME ZONE 'Asia/Manila')::date >= ${start}::date AND (created_at AT TIME ZONE 'Asia/Manila')::date < ${start}::date + INTERVAL '1 month'
      GROUP BY 1, 2 ORDER BY 1
    `),
  ]);
  return { collected: (money as { rows: DailyCollected[] }).rows, orders: (orders as { rows: DailyOrders[] }).rows };
}
