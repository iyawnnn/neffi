import "server-only";
import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { OrderError } from "./errors";

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
