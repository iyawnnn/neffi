import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../db";
import { loadOrderFacts } from "./order";

const CURSOR = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}(:\d{2})?)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export async function listOrders(db: Db, { before, status, assigneeId, purchaserId }: { before?: string; status?: "in_progress" | "completed" | "cancelled"; assigneeId?: string; purchaserId?: string } = {}) {
  const cursor = before ? CURSOR.exec(before) : null;
  const lines = db.select({ subtotal: sql<number>`coalesce(sum(coalesce(${schema.orderItems.agreedTotal}, ${schema.orderItems.quantity}::bigint * ${schema.orderItems.unitPrice})), 0)::float8`.as("subtotal") }).from(schema.orderItems).where(eq(schema.orderItems.orderId, schema.orders.id)).as("lines");
  const netPaid = sql<number>`coalesce((select sum(amount) from payments where order_id = ${schema.orders.id} and voided_at is null), 0) - coalesce((select sum(amount) from refunds where order_id = ${schema.orders.id} and voided_at is null), 0)`;
  const rows = await db.select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status, purchaserName: schema.purchasers.name, assignedToAccountId: schema.orders.assignedToAccountId, createdAt: schema.orders.createdAt,
    orderTotal: sql<number>`(${lines.subtotal} + ${schema.orders.shippingFee})::float8`,
    balance: sql<number>`greatest(${lines.subtotal} + ${schema.orders.shippingFee} - (${netPaid}), 0)::float8`,
    cursor: sql<string>`${schema.orders.createdAt}::text || '|' || ${schema.orders.id}::text`,
  }).from(schema.orders).innerJoin(schema.purchasers, eq(schema.purchasers.id, schema.orders.purchaserId)).leftJoinLateral(lines, sql`true`)
    .where(and(purchaserId ? eq(schema.orders.purchaserId, purchaserId) : undefined, status ? eq(schema.orders.status, status) : undefined, assigneeId ? eq(schema.orders.assignedToAccountId, assigneeId) : undefined, cursor ? sql`(${schema.orders.createdAt}, ${schema.orders.id}) < (${cursor[1]}::timestamptz, ${cursor[4]}::uuid)` : undefined))
    .orderBy(desc(schema.orders.createdAt), desc(schema.orders.id)).limit(26);
  const page = rows.slice(0, 25);
  return { orders: page, next: rows.length > 25 ? page[24].cursor : null };
}

export function orderAssignees(db: Db) {
  return db.select({ id: schema.accounts.id, email: schema.accounts.email }).from(schema.accounts).where(eq(schema.accounts.role, "owner")).orderBy(asc(schema.accounts.email));
}

export async function getOrderDetail(db: Db, id: string) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!order) return null;
  const [facts, purchaser, items, payments, refunds, cards, shipments, timeline, assignees, readyDbcCards] = await Promise.all([
    loadOrderFacts(db, id),
    db.select().from(schema.purchasers).where(eq(schema.purchasers.id, order.purchaserId)),
    db.select({ id: schema.orderItems.id, productId: schema.orderItems.productId, productKind: schema.orderItems.productKind, name: schema.products.name, quantity: schema.orderItems.quantity, unitPrice: schema.orderItems.unitPrice, agreedTotal: schema.orderItems.agreedTotal, label: schema.orderItems.label, reviewUrl: schema.orderItems.reviewUrl,
      activeCount: sql<number>`(SELECT count(*)::int FROM cards c WHERE c.order_item_id = order_items.id AND c.kind = 'dbc' AND order_items.product_kind = 'dbc' AND c.state IN ('reserved', 'released'))`,
      releasedCount: sql<number>`(SELECT count(*)::int FROM cards c WHERE c.order_item_id = order_items.id AND c.kind = 'dbc' AND order_items.product_kind = 'dbc' AND c.state = 'released')`,
    }).from(schema.orderItems).innerJoin(schema.products, eq(schema.products.id, schema.orderItems.productId)).where(eq(schema.orderItems.orderId, id)).orderBy(asc(schema.orderItems.createdAt), asc(schema.orderItems.id)),
    db.select().from(schema.payments).where(eq(schema.payments.orderId, id)).orderBy(desc(schema.payments.createdAt), desc(schema.payments.id)),
    db.select().from(schema.refunds).where(eq(schema.refunds.orderId, id)).orderBy(desc(schema.refunds.createdAt), desc(schema.refunds.id)),
    db.select({ id: schema.cards.id, orderItemId: schema.cards.orderItemId, kind: schema.cards.kind, state: schema.cards.state, suffix: sql<string>`right(${schema.cards.publicToken}, 4)`, nfcVerifiedAt: schema.cards.nfcVerifiedAt, packageMatchedAt: schema.cards.packageMatchedAt }).from(schema.cards).innerJoin(schema.orderItems, eq(schema.orderItems.id, schema.cards.orderItemId)).where(and(eq(schema.orderItems.orderId, id), eq(schema.cards.kind, "dbc"))),
    db.select().from(schema.shipments).where(and(eq(schema.shipments.orderId, id), sql`${schema.shipments.supportCaseId} is null`)).orderBy(desc(schema.shipments.createdAt)),
    db.select({ id: schema.activityEvents.id, type: schema.activityEvents.type, note: schema.activityEvents.note, createdAt: schema.activityEvents.createdAt }).from(schema.activityEvents).where(eq(schema.activityEvents.orderId, id)).orderBy(desc(schema.activityEvents.createdAt), desc(schema.activityEvents.id)),
    orderAssignees(db),
    db.select({ id: schema.cards.id, productId: schema.cards.productId, suffix: sql<string>`right(${schema.cards.publicToken}, 4)`, receivedOn: schema.stockPurchases.receivedOn }).from(schema.cards).innerJoin(schema.stockPurchases, eq(schema.stockPurchases.id, schema.cards.stockPurchaseId))
      .where(and(eq(schema.cards.kind, "dbc"), eq(schema.cards.state, "ready"), sql`exists(select 1 from order_items where order_id = ${id} and product_kind = 'dbc' and product_id = ${schema.cards.productId})`)).orderBy(asc(schema.cards.createdAt), asc(schema.cards.id)),
  ]);
  return { ...order, purchaser: purchaser[0], totals: facts.totals, anyReleased: facts.anyReleased, hasCommercialDelivery: facts.hasCommercialDelivery,
    items,
    payments, refunds, cards, shipments, timeline, assignees, readyDbcCards };
}
