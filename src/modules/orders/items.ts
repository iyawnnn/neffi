import "server-only";
import { and, count, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import { activeProduct, CardError } from "../cards/card";
import type { Db } from "../db";
import { orderLineSchema } from "./create";
import { OrderError } from "./errors";
import { loadOrderFacts, mutateOrder } from "./order";

type Mutation = { orderId: string; actorId: string };

async function lockItem(tx: Db, orderId: string, itemId: string) {
  const [item] = await tx.select().from(schema.orderItems).where(and(eq(schema.orderItems.id, itemId), eq(schema.orderItems.orderId, orderId))).for("update");
  if (!item) throw new OrderError("not_found");
  return item;
}

export async function addOrderItem(db: Db, input: Mutation & Record<string, unknown>): Promise<string> {
  const line = orderLineSchema.safeParse(input);
  if (!line.success) throw new OrderError("invalid_input");
  return mutateOrder(db, input, async (tx, order) => {
    if (order.clientKey) throw new OrderError("wrong_status");
    if (line.data.kind === "grc" && (await loadOrderFacts(tx, input.orderId)).hasCommercialDelivery) throw new OrderError("items_delivered");
    const product = await activeProduct(tx, line.data.kind).catch((error) => {
      if (error instanceof CardError && error.code === "no_product") throw new OrderError("no_product");
      throw error;
    });
    const [item] = await tx.insert(schema.orderItems).values({ orderId: input.orderId, productId: product.id, productKind: line.data.kind, quantity: line.data.quantity, unitPrice: product.price, agreedTotal: line.data.agreedTotal, label: line.data.label, reviewUrl: line.data.reviewUrl }).returning({ id: schema.orderItems.id });
    await recordActivity(tx, { type: "order_items_changed", actorAccountId: input.actorId, orderId: input.orderId });
    return item.id;
  });
}

export async function updateOrderItem(db: Db, input: Mutation & { orderItemId: string } & Record<string, unknown>): Promise<void> {
  return mutateOrder(db, input, async (tx, order) => {
    if (order.clientKey) throw new OrderError("wrong_status");
    const item = await lockItem(tx, input.orderId, input.orderItemId);
    const line = orderLineSchema.safeParse({ ...input, kind: item.productKind });
    if (!line.success) throw new OrderError("invalid_input");
    const facts = await loadOrderFacts(tx, input.orderId);
    if (item.productKind === "dbc" && line.data.quantity < facts.items.find((f) => f.id === item.id)!.allocatedCount) throw new OrderError("item_full");
    if (item.productKind === "grc" && facts.hasCommercialDelivery && line.data.quantity !== item.quantity) throw new OrderError("items_delivered");
    await tx.update(schema.orderItems).set({ quantity: line.data.quantity, agreedTotal: line.data.agreedTotal ?? null, label: line.data.label ?? null, reviewUrl: line.data.reviewUrl ?? null }).where(eq(schema.orderItems.id, item.id));
    await recordActivity(tx, { type: "order_items_changed", actorAccountId: input.actorId, orderId: input.orderId });
  });
}

export async function removeOrderItem(db: Db, input: Mutation & { orderItemId: string }): Promise<void> {
  return mutateOrder(db, input, async (tx, order) => {
    if (order.clientKey) throw new OrderError("wrong_status");
    const item = await lockItem(tx, input.orderId, input.orderItemId);
    const facts = await loadOrderFacts(tx, input.orderId);
    if (facts.items.length === 1) throw new OrderError("last_item");
    if (item.productKind === "grc" && facts.hasCommercialDelivery) throw new OrderError("items_delivered");
    const [{ linked }] = await tx.select({ linked: count() }).from(schema.cards).where(eq(schema.cards.orderItemId, item.id));
    if (linked) throw new OrderError("item_has_cards");
    await tx.delete(schema.orderItems).where(eq(schema.orderItems.id, item.id));
    await recordActivity(tx, { type: "order_items_changed", actorAccountId: input.actorId, orderId: input.orderId });
  });
}
