import "server-only";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { OrderError } from "../orders/errors";

export type ExpenseInput = { id?: string; actorId: string; spentOn: string; amount: number; category: typeof schema.expenses.$inferSelect.category; payee?: string | null; note?: string | null; orderId?: string | null };

export async function saveExpense(db: Db, { id, actorId, ...fields }: ExpenseInput) {
  if (!Number.isInteger(fields.amount) || fields.amount <= 0 || fields.amount > 1_000_000_000) throw new OrderError("invalid_input");
  if (fields.orderId) {
    const [order] = await db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.id, fields.orderId));
    if (!order) throw new OrderError("not_found");
  }
  const [row] = id ? await db.update(schema.expenses).set(fields).where(eq(schema.expenses.id, id)).returning({ id: schema.expenses.id }) : await db.insert(schema.expenses).values({ ...fields, createdByAccountId: actorId }).returning({ id: schema.expenses.id });
  if (!row) throw new OrderError("not_found");
  return row.id;
}

export async function deleteExpense(db: Db, id: string) {
  const rows = await db.delete(schema.expenses).where(eq(schema.expenses.id, id)).returning({ id: schema.expenses.id });
  if (!rows.length) throw new OrderError("not_found");
}
