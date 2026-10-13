import "server-only";
import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { CardError, lockCard } from "./card";

// Cards that count against an item's quantity. Retired cards (failed or replaced) do not, but stay linked as history.
export const COUNTED_STATES = ["reserved", "released"] as const;

// An item that can still take a card: GRC, open order, a verified destination, and capacity left.
export async function eligibleGrcItems(db: Db) {
  return db
    .select({
      orderItemId: schema.orderItems.id,
      orderNumber: schema.orders.number,
      label: schema.orderItems.label,
      reviewUrl: schema.orderItems.reviewUrl,
      remaining: sql<number>`${schema.orderItems.quantity} - count(${schema.cards.id})::int`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .leftJoin(
      schema.cards,
      and(eq(schema.cards.orderItemId, schema.orderItems.id), inArray(schema.cards.state, [...COUNTED_STATES])),
    )
    .where(and(eq(schema.orders.status, "in_progress"), eq(schema.orderItems.productKind, "grc"), isNotNull(schema.orderItems.reviewUrl)))
    .groupBy(schema.orderItems.id, schema.orders.number)
    .having(sql`count(${schema.cards.id}) < ${schema.orderItems.quantity}`)
    .orderBy(desc(schema.orders.number))
    .limit(100);
}

// Blank -> Reserved against an existing eligible Order Item. Locks the item, then the card (never the reverse), so
// two owners racing for the last slot serialize and exactly one wins.
export async function reserveGrc(db: Db, input: { actorId: string; cardId: string; orderItemId: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const [item] = await tx
      .select({
        id: schema.orderItems.id,
        productId: schema.orderItems.productId,
        productKind: schema.orderItems.productKind,
        quantity: schema.orderItems.quantity,
        reviewUrl: schema.orderItems.reviewUrl,
        orderId: schema.orders.id,
        orderStatus: schema.orders.status,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(eq(schema.orderItems.id, input.orderItemId))
      .for("update", { of: schema.orderItems });
    if (!item || item.productKind !== "grc" || !item.reviewUrl || item.orderStatus !== "in_progress") throw new CardError("item_ineligible");

    const card = await lockCard(tx, input.cardId);
    if (card.state !== "blank" || card.kind === "dbc" || card.publicToken) throw new CardError("wrong_state");

    const [{ taken }] = await tx
      .select({ taken: count() })
      .from(schema.cards)
      .where(and(eq(schema.cards.orderItemId, item.id), inArray(schema.cards.state, [...COUNTED_STATES])));
    if (taken >= item.quantity) throw new CardError("item_full");

    await tx
      .update(schema.cards)
      .set({ state: "reserved", productId: item.productId, kind: "grc", orderItemId: item.id })
      .where(eq(schema.cards.id, card.id));
    await recordActivity(tx, { type: "card_reserved", actorAccountId: input.actorId, cardId: card.id, orderId: item.orderId });
  });
}
