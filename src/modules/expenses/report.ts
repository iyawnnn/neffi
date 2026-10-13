import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "../db";
import type { expenses } from "../../db/schema";

export type ExpenseRow = { id: string; source: "manual" | "stock" | "inbound" | "courier"; spentOn: string; amount: number; category: typeof expenses.$inferSelect.category; payee: string | null; note: string | null; orderId: string | null };

export async function expenseReport(db: Db, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError("Choose a valid month");
  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT id, 'manual' AS source, spent_on::text AS "spentOn", amount, category::text AS category, payee, note, order_id AS "orderId" FROM expenses
      UNION ALL SELECT id, 'stock', received_on::text, purchase_cost, 'inventory_production', supplier, reference, NULL::uuid FROM stock_purchases WHERE purchase_cost IS NOT NULL
      UNION ALL SELECT id, 'inbound', received_on::text, inbound_shipping_cost, 'shipping_delivery', supplier, reference, NULL::uuid FROM stock_purchases WHERE inbound_shipping_cost IS NOT NULL
      UNION ALL SELECT id, 'courier', shipped_on::text, courier_cost, 'shipping_delivery', courier, tracking_number, order_id FROM shipments WHERE courier_cost IS NOT NULL AND shipped_on IS NOT NULL
    ) costs WHERE "spentOn" >= ${month + "-01"} AND "spentOn" < (${month + "-01"}::date + INTERVAL '1 month')::date::text
    ORDER BY "spentOn" DESC, id, source
  `);
  const rows = (result as { rows: ExpenseRow[] }).rows;
  const categories = Object.fromEntries(["inventory_production", "shipping_delivery", "packaging_printing", "software_operations", "marketing", "other"].map((category) => [category, 0]));
  for (const row of rows) categories[row.category] += row.amount;
  return { rows, categories, total: rows.reduce((sum, row) => sum + row.amount, 0) };
}
