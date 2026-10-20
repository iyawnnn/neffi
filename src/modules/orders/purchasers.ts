import "server-only";
import { asc, count, eq, or, ilike, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { OrderError } from "./errors";
import { listOrders } from "./queries";

export const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");
export function listPurchasers(db: Db, query = "") {
  const pattern = `%${escapeLike(query)}%`;
  return db.select().from(schema.purchasers).where(query ? or(ilike(schema.purchasers.name, pattern), ilike(schema.purchasers.contactNumber, pattern)) : undefined).orderBy(asc(schema.purchasers.name), asc(schema.purchasers.id)).limit(50);
}
const purchaserMatch = (query: string) => {
  const pattern = `%${escapeLike(query)}%`;
  return query ? or(ilike(schema.purchasers.name, pattern), ilike(schema.purchasers.contactNumber, pattern)) : undefined;
};

export async function countPurchasers(db: Db, query = "") {
  const [row] = await db.select({ total: count() }).from(schema.purchasers).where(purchaserMatch(query));
  return row.total;
}

// The Customers list: a numbered page of purchasers with how many orders and cards each has.
export function listPurchaserDirectory(db: Db, { query = "", offset = 0, limit }: { query?: string; offset?: number; limit: number }) {
  return db.select({
    id: schema.purchasers.id, name: schema.purchasers.name, contactNumber: schema.purchasers.contactNumber,
    orderCount: sql<number>`(select count(*)::int from orders o where o.purchaser_id = purchasers.id)`,
    cardCount: sql<number>`(select count(*)::int from cards c join order_items i on i.id = c.order_item_id join orders o on o.id = i.order_id where o.purchaser_id = purchasers.id)`,
  }).from(schema.purchasers).where(purchaserMatch(query)).orderBy(asc(schema.purchasers.name), asc(schema.purchasers.id)).limit(limit).offset(offset);
}

export async function updatePurchaser(db: Db, { id, name, contactNumber }: { id: string; name: string; contactNumber?: string | null }) {
  if (!name.trim()) throw new OrderError("invalid_input");
  const rows = await db.update(schema.purchasers).set({ name: name.trim(), contactNumber: contactNumber?.trim() || null }).where(eq(schema.purchasers.id, id)).returning({ id: schema.purchasers.id });
  if (!rows.length) throw new OrderError("not_found");
}
export async function purchaserOrders(db: Db, purchaserId: string) {
  return (await listOrders(db, { purchaserId })).orders;
}

export async function getPurchaser(db: Db, id: string) {
  const [purchaser] = await db.select().from(schema.purchasers).where(eq(schema.purchasers.id, id));
  return purchaser ?? null;
}

export async function resolvePurchaser(tx: Db, input: { purchaserId?: string; purchaser?: { name: string; contactNumber?: string } }) {
  if (input.purchaserId) {
    const purchaser = await getPurchaser(tx, input.purchaserId);
    if (!purchaser) throw new OrderError("not_found");
    return purchaser.id;
  }
  if (!input.purchaser?.name.trim()) throw new OrderError("invalid_input");
  const [purchaser] = await tx.insert(schema.purchasers).values(input.purchaser).returning({ id: schema.purchasers.id });
  return purchaser.id;
}
