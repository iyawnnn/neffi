import "server-only";
import { eq, sql } from "drizzle-orm";
import { orderItems } from "../../db/schema";
import type { CredentialSecrets } from "../activation/encryption";
import type { Db } from "../db";

export type AllocationResult = { allocatedCardIds: string[]; missingQuantity: number };

// shortcut: reports the deficit without allocating stock; Task 6 replaces this with locked Ready/Blank allocation.
export async function allocateDbcCards(db: Db, input: { actorId: string; orderId: string; secrets: CredentialSecrets }): Promise<AllocationResult> {
  const [row] = await db.select({ quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` }).from(orderItems).where(eq(orderItems.orderId, input.orderId));
  return { allocatedCardIds: [], missingQuantity: row.quantity };
}
