import "server-only";
import { desc, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { inventoryStatusCounts } from "../inventory/queries";
import { expenseReport } from "../expenses/report";
import { openCaseCount } from "../support/queries";

export async function dashboard(db: Db, month: string) {
  const [report, stock, recent, openSupportCases] = await Promise.all([
    expenseReport(db, month), inventoryStatusCounts(db),
    db.select({ id: schema.activityEvents.id, type: schema.activityEvents.type, note: schema.activityEvents.note, orderId: schema.activityEvents.orderId, cardId: schema.activityEvents.cardId, stockPurchaseId: schema.activityEvents.stockPurchaseId, createdAt: schema.activityEvents.createdAt }).from(schema.activityEvents).orderBy(desc(schema.activityEvents.createdAt), desc(schema.activityEvents.id)).limit(15),
    openCaseCount(db),
  ]);
  const result = await db.execute(sql`
    SELECT count(*) filter (where status = 'in_progress')::int AS "inProgress", coalesce(sum(greatest(
      shipping_fee + coalesce((SELECT sum(coalesce(i.agreed_total, i.quantity::bigint * i.unit_price)) FROM order_items i WHERE i.order_id = o.id), 0)
      - coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id = o.id AND p.voided_at IS NULL), 0)
      + coalesce((SELECT sum(r.amount) FROM refunds r WHERE r.order_id = o.id AND r.voided_at IS NULL AND r.support_case_id IS NULL), 0), 0)) filter (where not shipping_fee_pending), 0)::float8 AS outstanding,
      ((SELECT coalesce(sum(amount), 0) FROM payments WHERE voided_at IS NULL AND paid_on >= ${month + "-01"}::date AND paid_on < ${month + "-01"}::date + INTERVAL '1 month')
      - (SELECT coalesce(sum(amount), 0) FROM refunds WHERE voided_at IS NULL AND refunded_on >= ${month + "-01"}::date AND refunded_on < ${month + "-01"}::date + INTERVAL '1 month'))::float8 AS collected
    FROM orders o WHERE status IN ('in_progress', 'completed')
  `);
  const [totals] = (result as { rows: { inProgress: number; outstanding: number; collected: number }[] }).rows;
  return { ...totals, openSupportCases, expenses: report.total, stock: { status: stock }, recent };
}
