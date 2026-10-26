import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { OrderError } from "./errors";
import { returnCardToStock } from "./fulfillment";
import { loadOrderFacts, mutateOrder } from "./order";

export async function cancelOrder(db: Db, input: { orderId: string; actorId: string; reason?: string }): Promise<void> {
  const reason = z.string().trim().max(500).optional().safeParse(input.reason);
  if (!reason.success) throw new OrderError("invalid_input");
  await mutateOrder(db, input, async (tx) => {
    const facts = await loadOrderFacts(tx, input.orderId);
    if (facts.anyReleased || facts.hasCommercialDelivery) throw new OrderError("already_released");
    const allocated = await tx.select({ id: schema.cards.id }).from(schema.cards).innerJoin(schema.orderItems, eq(schema.orderItems.id, schema.cards.orderItemId))
      .where(and(eq(schema.orderItems.orderId, input.orderId), eq(schema.cards.kind, "dbc"), inArray(schema.cards.state, ["preparing", "reserved"]))).orderBy(asc(schema.cards.id));
    for (const card of allocated) await returnCardToStock(tx, { ...input, cardId: card.id });
    await tx.update(schema.orders).set({ status: "cancelled", cancelledAt: new Date(), cancellationReason: reason.data ?? null }).where(eq(schema.orders.id, input.orderId));
    await recordActivity(tx, { type: "order_cancelled", actorAccountId: input.actorId, orderId: input.orderId, note: reason.data });
  });
}
