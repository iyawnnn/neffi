import "server-only";
import { eq, ilike, or, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "./db";
import { escapeLike } from "./orders/purchasers";

export async function search(db: Db, query: string) {
  const term = query.trim().slice(0, 100);
  if (!term) return { orders: [], purchasers: [], accounts: [], cards: [], shipments: [] };
  const pattern = `%${escapeLike(term)}%`;
  const [orders, purchasers, accounts, cards, shipments] = await Promise.all([
    db.select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status }).from(schema.orders).where(sql`${schema.orders.number}::text = ${term}`).orderBy(schema.orders.number).limit(8),
    db.select({ id: schema.purchasers.id, name: schema.purchasers.name, contactNumber: schema.purchasers.contactNumber }).from(schema.purchasers).where(or(ilike(schema.purchasers.name, pattern), ilike(schema.purchasers.contactNumber, pattern))).orderBy(schema.purchasers.name, schema.purchasers.id).limit(8),
    db.select({ id: schema.accounts.id, email: schema.accounts.email }).from(schema.accounts).where(ilike(schema.accounts.email, pattern)).orderBy(schema.accounts.email).limit(8),
    db.select({ id: schema.cards.id, publicToken: schema.cards.publicToken, kind: schema.cards.kind, state: schema.cards.state }).from(schema.cards).where(or(eq(schema.cards.publicToken, term), sql`${schema.cards.id}::text = ${term}`)).orderBy(schema.cards.id).limit(8),
    db.select({ id: schema.shipments.id, orderId: schema.shipments.orderId, trackingNumber: schema.shipments.trackingNumber }).from(schema.shipments).where(ilike(schema.shipments.trackingNumber, pattern)).orderBy(schema.shipments.id).limit(8),
  ]);
  return { orders, purchasers, accounts, cards, shipments };
}
