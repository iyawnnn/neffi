import "server-only";
import { count, desc, eq, getTableColumns, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { OrderError } from "../orders/errors";

export type StockPurchaseFields = {
  receivedOn: string; supplier?: string | null; reference?: string | null; notes?: string | null;
  purchaseCost?: number | null; inboundShippingCost?: number | null;
};

export function validateStockCosts(input: StockPurchaseFields) {
  for (const value of [input.purchaseCost, input.inboundShippingCost]) {
    if (value != null && (!Number.isInteger(value) || value <= 0 || value > 1_000_000_000)) throw new OrderError("invalid_input");
  }
}

export async function updateStockPurchase(db: Db, { stockPurchaseId, ...fields }: StockPurchaseFields & { stockPurchaseId: string }) {
  validateStockCosts(fields);
  const rows = await db.update(schema.stockPurchases).set(fields).where(eq(schema.stockPurchases.id, stockPurchaseId)).returning({ id: schema.stockPurchases.id });
  if (!rows.length) throw new OrderError("not_found");
}

const projection = {
  ...getTableColumns(schema.stockPurchases),
  quantity: sql<number>`(SELECT count(*)::int FROM cards c WHERE c.stock_purchase_id = stock_purchases.id)`,
  states: sql<Record<string, number>>`COALESCE((SELECT jsonb_object_agg(s.state, s.n) FROM (SELECT c.state, count(*)::int AS n FROM cards c WHERE c.stock_purchase_id = stock_purchases.id GROUP BY c.state) s), '{}'::jsonb)`,
};

export async function countStockPurchases(db: Db) {
  const [row] = await db.select({ total: count() }).from(schema.stockPurchases);
  return row.total;
}

export async function listStockPurchases(db: Db, { offset = 0, limit }: { offset?: number; limit: number }) {
  return db.select(projection).from(schema.stockPurchases).orderBy(desc(schema.stockPurchases.receivedOn), desc(schema.stockPurchases.id)).limit(limit).offset(offset);
}

export async function getStockPurchase(db: Db, id: string) {
  const [row] = await db.select(projection).from(schema.stockPurchases).where(eq(schema.stockPurchases.id, id));
  return row ?? null;
}
