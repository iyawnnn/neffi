import "server-only";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { OrderError } from "./errors";
import { isCompletionEligible, orderTotals, type ItemFacts, type OrderFacts } from "./totals";

type Order = typeof schema.orders.$inferSelect;
type Facts = Omit<OrderFacts, "items"> & { items: (ItemFacts & { id: string })[]; anyReleased: boolean };

export async function lockOrder(tx: Db, id: string): Promise<Order> {
  const [order] = await tx.select().from(schema.orders).where(eq(schema.orders.id, id)).for("update");
  if (!order) throw new OrderError("not_found");
  return order;
}

export async function loadOrderFacts(tx: Db, id: string) {
  const result = await tx.execute<Facts>(sql`
    select o.status, o.delivery_method as "deliveryMethod", o.shipping_fee as "shippingFee",
      coalesce(lines.items, '[]'::jsonb) as items,
      coalesce((select sum(amount)::float8 from payments where order_id = o.id and voided_at is null), 0) as received,
      coalesce((select sum(amount)::float8 from refunds where order_id = o.id and voided_at is null), 0) as refunded,
      exists(select 1 from shipments where order_id = o.id and shipped_on is not null and support_case_id is null) as "hasShippedShipment",
      coalesce(lines.any_released, false) as "anyReleased"
    from orders o
    left join lateral (
      select jsonb_agg(jsonb_build_object('id', i.id, 'quantity', i.quantity, 'unitPrice', i.unit_price,
        'agreedTotal', i.agreed_total, 'activeCount', counts.active, 'releasedCount', counts.released)) as items,
        bool_or(counts.released > 0) as any_released
      from order_items i
      cross join lateral (
        select count(*) filter (where state in ('reserved', 'released'))::int as active,
          count(*) filter (where state = 'released')::int as released
        from cards where order_item_id = i.id
      ) counts
      where i.order_id = o.id
    ) lines on true
    where o.id = ${id}
  `);
  const facts = (result as { rows: Facts[] }).rows[0];
  if (!facts) throw new OrderError("not_found");
  return { ...facts, totals: orderTotals(facts) };
}

// Caller holds the parent order lock; input-changing mutations all settle before committing.
export async function settleOrderCompletion(tx: Db, id: string, actorId: string): Promise<void> {
  if (!isCompletionEligible(await loadOrderFacts(tx, id))) return;
  await tx.update(schema.orders).set({ status: "completed", completedAt: new Date() }).where(eq(schema.orders.id, id));
  await recordActivity(tx, { type: "order_completed", orderId: id, actorAccountId: actorId });
}

export async function mutateOrder<T>(db: Db, input: { orderId: string; actorId: string; allow?: Order["status"][] }, fn: (tx: Db, order: Order) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId);
    if (!(input.allow ?? ["in_progress"]).includes(order.status)) throw new OrderError("wrong_status");
    const result = await fn(tx, order);
    await tx.update(schema.orders).set({ updatedByAccountId: input.actorId }).where(eq(schema.orders.id, order.id));
    await settleOrderCompletion(tx, order.id, input.actorId);
    return result;
  });
}
