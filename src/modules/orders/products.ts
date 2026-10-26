import "server-only";
import { and, asc, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { OrderError } from "./errors";
import { NORMAL_DBC_UNIT_PRICE } from "./policy";

export function listProducts(db: Db) {
  return db.select({ id: schema.products.id, kind: schema.products.kind, name: schema.products.name, price: schema.products.price }).from(schema.products).where(eq(schema.products.active, true)).orderBy(asc(schema.products.kind));
}

export function listOwnerAccess(db: Db) {
  return db.select({ email: schema.accounts.email, role: schema.accounts.role, createdAt: schema.accounts.createdAt }).from(schema.accounts).where(eq(schema.accounts.role, "owner")).orderBy(asc(schema.accounts.email));
}

export async function saveProduct(db: Db, input: { productId?: string; kind: "dbc" | "grc"; name: string; price: number }): Promise<string> {
  if (input.kind === "dbc" && input.price !== NORMAL_DBC_UNIT_PRICE) throw new OrderError("invalid_input");
  const rows = input.productId
    ? await db.update(schema.products).set(input.kind === "dbc" ? { name: input.name } : { name: input.name, price: input.price }).where(and(eq(schema.products.id, input.productId), eq(schema.products.kind, input.kind), eq(schema.products.active, true))).returning({ id: schema.products.id })
    : await db.insert(schema.products).values({ kind: input.kind, name: input.name, price: input.price }).onConflictDoNothing().returning({ id: schema.products.id });
  if (!rows[0]) throw new OrderError(input.productId ? "not_found" : "no_product");
  return rows[0].id;
}
