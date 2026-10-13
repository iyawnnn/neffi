import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import * as schema from "../../db/schema";
import { usableCredential } from "../activation/credentials";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { OrderError } from "./errors";
import { loadOrderFacts, mutateOrder } from "./order";

type Mutation = { orderId: string; actorId: string };

export async function reserveDbcCards(db: Db, input: Mutation & { orderItemId: string; cardIds: string[] }): Promise<void> {
  if (!z.array(z.uuid()).min(1).max(500).safeParse(input.cardIds).success || new Set(input.cardIds).size !== input.cardIds.length) throw new OrderError("invalid_input");
  await mutateOrder(db, input, async (tx) => {
    const [item] = await tx.select().from(schema.orderItems).where(and(eq(schema.orderItems.id, input.orderItemId), eq(schema.orderItems.orderId, input.orderId))).for("update");
    if (!item || item.productKind !== "dbc") throw new OrderError("invalid_input");
    const facts = await loadOrderFacts(tx, input.orderId);
    if (input.cardIds.length > item.quantity - facts.items.find((f) => f.id === item.id)!.activeCount) throw new OrderError("item_full");
    const reserved = await tx.update(schema.cards).set({ state: "reserved", orderItemId: item.id }).where(and(inArray(schema.cards.id, input.cardIds), eq(schema.cards.state, "ready"), eq(schema.cards.kind, "dbc"), eq(schema.cards.productId, item.productId))).returning({ id: schema.cards.id });
    if (reserved.length !== input.cardIds.length) throw new OrderError("card_unavailable");
    for (const card of reserved) await recordActivity(tx, { type: "card_reserved", actorAccountId: input.actorId, orderId: input.orderId, cardId: card.id });
  });
}

export async function returnCardToStock(db: Db, input: Mutation & { cardId: string }): Promise<void> {
  await mutateOrder(db, input, async (tx) => {
    const [card] = await tx.select({ id: schema.cards.id, state: schema.cards.state }).from(schema.cards).innerJoin(schema.orderItems, eq(schema.orderItems.id, schema.cards.orderItemId))
      .where(and(eq(schema.cards.id, input.cardId), eq(schema.cards.kind, "dbc"), eq(schema.orderItems.orderId, input.orderId))).for("update", { of: schema.cards });
    if (!card || card.state !== "reserved") throw new OrderError("card_unavailable");
    await tx.update(schema.cards).set({ state: "ready", orderItemId: null }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, { type: "card_returned", actorAccountId: input.actorId, orderId: input.orderId, cardId: card.id });
  });
}

async function releaseDbcs(tx: Db, input: Mutation): Promise<number> {
  const cards = await tx.select({ id: schema.cards.id, packageMatchedAt: schema.cards.packageMatchedAt }).from(schema.cards)
    .innerJoin(schema.orderItems, eq(schema.orderItems.id, schema.cards.orderItemId))
    .where(and(eq(schema.orderItems.orderId, input.orderId), eq(schema.cards.kind, "dbc"), eq(schema.cards.state, "reserved")))
    .orderBy(asc(schema.cards.id)).for("update", { of: schema.cards });
  for (const card of cards) {
    if (!card.packageMatchedAt || !await usableCredential(tx, card.id)) throw new OrderError("checks_incomplete");
  }
  for (const card of cards) {
    await tx.update(schema.cards).set({ state: "released" }).where(eq(schema.cards.id, card.id));
    await recordActivity(tx, { type: "card_released", actorAccountId: input.actorId, orderId: input.orderId, cardId: card.id });
  }
  return cards.length;
}

export async function handOverOrder(db: Db, input: Mutation): Promise<void> {
  await mutateOrder(db, input, async (tx, order) => {
    if (order.deliveryMethod !== "pickup" && order.deliveryMethod !== "local_handoff") throw new OrderError("wrong_delivery");
    const facts = await loadOrderFacts(tx, input.orderId);
    const released = await releaseDbcs(tx, input);
    if (!released && !(facts.items.some((item) => item.productKind === "grc") && !facts.hasCommercialDelivery)) throw new OrderError("nothing_reserved");
    if (!facts.hasHandedOver) await recordActivity(tx, { type: "order_handed_over", actorAccountId: input.actorId, orderId: input.orderId });
  });
}

const optionalText = (max: number) => z.string().trim().max(max).optional();
const cost = z.number().int().nonnegative().max(1_000_000_000).nullish();
const shippingInput = z.object({ shippedOn: z.iso.date().optional(), courier: optionalText(100), trackingNumber: optionalText(100), recipientName: optionalText(100), recipientContact: optionalText(100), address: optionalText(500), courierCost: cost });

export async function shipOrder(db: Db, input: Mutation & z.input<typeof shippingInput>): Promise<void> {
  const parsed = shippingInput.safeParse(input);
  if (!parsed.success) throw new OrderError("invalid_input");
  await mutateOrder(db, input, async (tx, order) => {
    if (order.deliveryMethod !== "courier") throw new OrderError("wrong_delivery");
    const facts = await loadOrderFacts(tx, input.orderId);
    const released = await releaseDbcs(tx, input);
    if (!released && !(facts.items.some((item) => item.productKind === "grc") && !facts.hasCommercialDelivery)) throw new OrderError("nothing_reserved");
    await tx.insert(schema.shipments).values({ orderId: input.orderId, ...parsed.data, status: "in_transit", shippedOn: parsed.data.shippedOn ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()) });
    await recordActivity(tx, { type: "shipment_recorded", actorAccountId: input.actorId, orderId: input.orderId });
  });
}

const shipmentUpdate = z.object({ status: z.enum(["in_transit", "delivered", "failed", "returned", "lost"]), trackingNumber: optionalText(100), courier: optionalText(100), courierCost: cost });

export async function updateShipment(db: Db, input: Mutation & { shipmentId: string } & z.input<typeof shipmentUpdate>): Promise<void> {
  const parsed = shipmentUpdate.safeParse(input);
  if (!parsed.success) throw new OrderError("invalid_input");
  await mutateOrder(db, { ...input, allow: ["in_progress", "completed"] }, async (tx) => {
    const updated = await tx.update(schema.shipments).set(parsed.data).where(and(eq(schema.shipments.id, input.shipmentId), eq(schema.shipments.orderId, input.orderId), isNull(schema.shipments.supportCaseId))).returning({ id: schema.shipments.id });
    if (!updated.length) throw new OrderError("not_found");
    await recordActivity(tx, { type: "shipment_updated", actorAccountId: input.actorId, orderId: input.orderId });
  });
}
