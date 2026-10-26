import "server-only";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { CredentialSecrets } from "../activation/encryption";
import { usableCredential } from "../activation/credentials";
import { recordActivity } from "../activity/record";
import { prepareAllocatedDbc } from "../cards/dbc";
import type { Db } from "../db";
import { OrderError } from "./errors";
import { loadOrderFacts, lockOrder } from "./order";

export type AllocationResult = { allocatedCardIds: string[]; missingQuantity: number };
type AllocationInput = { actorId: string; orderId: string; secrets: CredentialSecrets };

export async function allocationDeficit(db: Db, orderId: string): Promise<number> {
  const facts = await loadOrderFacts(db, orderId);
  return facts.items.reduce((missing, item) => missing + (item.productKind === "dbc" ? Math.max(item.quantity - item.allocatedCount, 0) : 0), 0);
}

export async function allocateDbcCardsInTransaction(tx: Db, input: AllocationInput & { orderItemId?: string }): Promise<AllocationResult> {
  const [actor] = await tx.select({ id: schema.accounts.id }).from(schema.accounts)
    .where(and(eq(schema.accounts.id, input.actorId), eq(schema.accounts.role, "owner")));
  if (!actor) throw new OrderError("invalid_input");
  const order = await lockOrder(tx, input.orderId);
  if (order.status !== "in_progress") throw new OrderError("wrong_status");
  const items = await tx.select({ id: schema.orderItems.id, productId: schema.orderItems.productId, quantity: schema.orderItems.quantity, active: schema.products.active })
    .from(schema.orderItems).innerJoin(schema.products, eq(schema.products.id, schema.orderItems.productId))
    .where(and(eq(schema.orderItems.orderId, input.orderId), eq(schema.orderItems.productKind, "dbc"), input.orderItemId ? eq(schema.orderItems.id, input.orderItemId) : undefined))
    .orderBy(asc(schema.orderItems.createdAt), asc(schema.orderItems.id)).for("update", { of: schema.orderItems });
  const allocatedCardIds: string[] = [];
  let missingQuantity = 0;
  for (const item of items) {
    const [counts] = await tx.select({ allocated: sql<number>`count(*)::int` }).from(schema.cards)
      .where(and(eq(schema.cards.orderItemId, item.id), eq(schema.cards.kind, "dbc"), sql`${schema.cards.state} in ('preparing', 'reserved', 'released')`));
    let missing = Math.max(item.quantity - counts.allocated, 0);
    if (!item.active) { missingQuantity += missing; continue; }
    const ready = await tx.select({ id: schema.cards.id }).from(schema.cards)
      .where(and(eq(schema.cards.state, "ready"), eq(schema.cards.kind, "dbc"), eq(schema.cards.productId, item.productId), isNull(schema.cards.orderItemId), sql`exists(select 1 from activation_credentials ac where ac.card_id = ${schema.cards.id} and ac.used_at is null and ac.revoked_at is null)`))
      .orderBy(asc(schema.cards.createdAt), asc(schema.cards.id)).limit(missing).for("update", { skipLocked: true });
    for (const card of ready) {
      if (!await usableCredential(tx, card.id)) continue;
      await tx.update(schema.cards).set({ state: "reserved", orderItemId: item.id }).where(eq(schema.cards.id, card.id));
      await recordActivity(tx, { type: "card_reserved", actorAccountId: input.actorId, orderId: input.orderId, cardId: card.id });
      allocatedCardIds.push(card.id);
      missing--;
    }
    if (missing) {
      const blank = await tx.select({ id: schema.cards.id }).from(schema.cards)
        .where(and(eq(schema.cards.state, "blank"), isNull(schema.cards.publicToken), isNull(schema.cards.orderItemId), or(isNull(schema.cards.productId), eq(schema.cards.productId, item.productId)), or(isNull(schema.cards.kind), eq(schema.cards.kind, "dbc")), sql`not exists(select 1 from activation_credentials ac where ac.card_id = ${schema.cards.id})`))
        .orderBy(asc(schema.cards.createdAt), asc(schema.cards.id)).limit(missing).for("update", { skipLocked: true });
      for (const card of blank) {
        await prepareAllocatedDbc(tx, { actorId: input.actorId, orderId: input.orderId, orderItemId: item.id, productId: item.productId, cardId: card.id, secrets: input.secrets });
        allocatedCardIds.push(card.id);
        missing--;
      }
    }
    missingQuantity += missing;
  }
  return { allocatedCardIds, missingQuantity };
}

export function allocateDbcCards(db: Db, input: AllocationInput): Promise<AllocationResult> {
  return db.transaction((tx) => allocateDbcCardsInTransaction(tx, input));
}

export async function allocateWaitingOrders(db: Db, input: { actorId: string; secrets: CredentialSecrets; limit: number }): Promise<number> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) throw new OrderError("invalid_input");
  const waiting = await db.select({ id: schema.orders.id }).from(schema.orders)
    .where(and(eq(schema.orders.status, "in_progress"), sql`exists(select 1 from order_items i where i.order_id = ${schema.orders.id} and i.product_kind = 'dbc' and i.quantity > (select count(*) from cards c where c.order_item_id = i.id and c.kind = 'dbc' and c.state in ('preparing', 'reserved', 'released')))`))
    .orderBy(asc(schema.orders.createdAt), asc(schema.orders.id)).limit(input.limit);
  for (const order of waiting) await allocateDbcCards(db, { ...input, orderId: order.id });
  return waiting.length;
}
