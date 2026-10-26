import "server-only";
import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { lockOrder } from "../orders/order";
import { CardError, lockCard } from "./card";

type Card = typeof schema.cards.$inferSelect;
type Item = typeof schema.orderItems.$inferSelect;
type OrderStatus = typeof schema.orders.$inferSelect["status"];

export async function withPreparationCard<T>(
  db: Db,
  input: { cardId: string; actorId: string },
  fn: (tx: Db, context: { card: Card; item: Item | null; orderId: string | null; orderStatus: OrderStatus | null }) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const [snapshot] = await tx.select({ orderItemId: schema.cards.orderItemId, orderId: schema.orderItems.orderId })
      .from(schema.cards).leftJoin(schema.orderItems, eq(schema.orderItems.id, schema.cards.orderItemId))
      .where(eq(schema.cards.id, input.cardId));
    if (!snapshot) throw new CardError("not_found");

    let item: Item | null = null;
    let orderStatus: OrderStatus | null = null;
    if (snapshot.orderItemId) {
      if (!snapshot.orderId) throw new CardError("item_ineligible");
      const order = await lockOrder(tx, snapshot.orderId);
      orderStatus = order.status;
      [item] = await tx.select().from(schema.orderItems)
        .where(and(eq(schema.orderItems.id, snapshot.orderItemId), eq(schema.orderItems.orderId, order.id)))
        .for("no key update");
      if (!item) throw new CardError("item_ineligible");
    }

    const card = await lockCard(tx, input.cardId);
    if (card.orderItemId !== snapshot.orderItemId) throw new CardError("retry");
    return fn(tx, { card, item, orderId: snapshot.orderId, orderStatus });
  });
}
