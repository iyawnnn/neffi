import "server-only";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { OrderError } from "./errors";
import { releaseDbcs } from "./fulfillment";
import { loadOrderFacts, mutateOrder } from "./order";

type Mutation = { orderId: string; actorId: string };

const manilaDate = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(date);
const fee = z.number().int().min(0).max(1_000_000_000);
const text = (max: number) => z.string().trim().min(1).max(max);
const deliveryInput = z.object({ recipientName: text(100), recipientPhone: text(100), address: text(500), shippingFee: fee.optional() });
const shipInput = z.object({ trackingNumber: text(100), shippedOn: z.iso.date().optional(), shippingFee: fee.optional() });
const correctionInput = z.object({ shippedOn: z.iso.date(), reason: text(200) });

// Normal J&T orders only; the courier is server-fixed and the payment method is the order's immutable one.
const normalCourierOrder = (order: typeof schema.orders.$inferSelect) => {
  if (!order.clientKey || order.deliveryMethod !== "courier") throw new OrderError("wrong_delivery");
};

const ownShipments = (tx: Db, orderId: string) =>
  tx.select().from(schema.shipments).where(and(eq(schema.shipments.orderId, orderId), isNull(schema.shipments.supportCaseId))).orderBy(asc(schema.shipments.createdAt), asc(schema.shipments.id));

async function setFee(tx: Db, orderId: string, shippingFee: number) {
  const { totals } = await loadOrderFacts(tx, orderId);
  if (totals.productSubtotal + shippingFee > 1_000_000_000) throw new OrderError("invalid_input");
  await tx.update(schema.orders).set({ shippingFee, shippingFeePending: false }).where(eq(schema.orders.id, orderId));
}

export async function saveJntDelivery(db: Db, input: Mutation & z.input<typeof deliveryInput>): Promise<void> {
  const parsed = deliveryInput.safeParse(input);
  if (!parsed.success) throw new OrderError("invalid_input");
  await mutateOrder(db, input, async (tx, order) => {
    normalCourierOrder(order);
    const shipments = await ownShipments(tx, order.id);
    const pending = shipments.filter((shipment) => shipment.status === "pending");
    if (pending.length > 1 || shipments.some((shipment) => shipment.shippedOn)) throw new OrderError("delivery_locked");
    const destination = { courier: "J&T", recipientName: parsed.data.recipientName, recipientContact: parsed.data.recipientPhone, address: parsed.data.address };
    if (pending.length) await tx.update(schema.shipments).set(destination).where(eq(schema.shipments.id, pending[0].id));
    else await tx.insert(schema.shipments).values({ orderId: order.id, ...destination });
    if (parsed.data.shippingFee !== undefined) await setFee(tx, order.id, parsed.data.shippingFee);
    await recordActivity(tx, { type: "shipment_updated", actorAccountId: input.actorId, orderId: order.id, note: "J&T delivery details saved" });
  });
}

// One transaction under the Order lock: confirm the fee, append the shipping receipt, ship, release, then mutateOrder settles.
export async function markJntShipped(db: Db, input: Mutation & z.input<typeof shipInput>): Promise<void> {
  const parsed = shipInput.safeParse(input);
  if (!parsed.success) throw new OrderError("invalid_input");
  await mutateOrder(db, { ...input, allow: ["in_progress", "completed"] }, async (tx, order) => {
    normalCourierOrder(order);
    const shipments = await ownShipments(tx, order.id);
    if (shipments.some((shipment) => shipment.shippedOn)) return;
    if (order.status !== "in_progress") throw new OrderError("wrong_status");

    const pending = shipments.filter((shipment) => shipment.status === "pending");
    if (pending.length !== 1) throw new OrderError(pending.length ? "delivery_locked" : "invalid_input");
    const [shipment] = pending;
    if (!shipment.recipientName?.trim() || !shipment.recipientContact?.trim() || !shipment.address?.trim()) throw new OrderError("invalid_input");

    const shippingFee = parsed.data.shippingFee ?? (order.shippingFeePending ? undefined : order.shippingFee);
    if (shippingFee === undefined) throw new OrderError("invalid_input");
    if (parsed.data.shippingFee !== undefined || order.shippingFeePending) await setFee(tx, order.id, shippingFee);

    const facts = await loadOrderFacts(tx, order.id);
    if (!facts.items.length || facts.items.some((item) => item.productKind !== "dbc" || item.preparedCount < item.quantity)) throw new OrderError("checks_incomplete");
    const { productSubtotal, received, refunded, afterSaleRefunded } = facts.totals;
    if (received !== productSubtotal || refunded !== 0 || afterSaleRefunded !== 0) throw new OrderError("settlement_mismatch");

    const shippedOn = parsed.data.shippedOn ?? manilaDate();
    if (shippedOn > manilaDate() || shippedOn < manilaDate(order.createdAt)) throw new OrderError("invalid_input");
    if (shippingFee > 0) {
      await tx.insert(schema.payments).values({ orderId: order.id, amount: shippingFee, method: order.normalPaymentMethod!, paidOn: shippedOn, recordedByAccountId: input.actorId });
      await recordActivity(tx, { type: "payment_recorded", actorAccountId: input.actorId, orderId: order.id, note: `${shippingFee} centavos; ${order.normalPaymentMethod}; shipping` });
    }
    await tx.update(schema.shipments).set({ courier: "J&T", trackingNumber: parsed.data.trackingNumber, status: "in_transit", shippedOn }).where(eq(schema.shipments.id, shipment.id));
    if (!await releaseDbcs(tx, input) && !facts.items.every((item) => item.releasedCount === item.quantity)) throw new OrderError("nothing_reserved");
    await recordActivity(tx, { type: "shipment_recorded", actorAccountId: input.actorId, orderId: order.id });
  });
}

export async function correctShipmentDate(db: Db, input: Mutation & { shipmentId: string } & z.input<typeof correctionInput>): Promise<void> {
  const parsed = correctionInput.safeParse(input);
  if (!parsed.success) throw new OrderError("invalid_input");
  await mutateOrder(db, { ...input, allow: ["in_progress", "completed"] }, async (tx) => {
    const [shipment] = await tx.select().from(schema.shipments)
      .where(and(eq(schema.shipments.id, input.shipmentId), eq(schema.shipments.orderId, input.orderId), isNull(schema.shipments.supportCaseId), isNotNull(schema.shipments.shippedOn))).for("update");
    if (!shipment) throw new OrderError("not_found");
    await tx.update(schema.shipments).set({ shippedOn: parsed.data.shippedOn }).where(eq(schema.shipments.id, shipment.id));
    await recordActivity(tx, { type: "shipment_updated", actorAccountId: input.actorId, orderId: input.orderId, note: `shipped date ${shipment.shippedOn} to ${parsed.data.shippedOn}; ${parsed.data.reason}` });
  });
}
