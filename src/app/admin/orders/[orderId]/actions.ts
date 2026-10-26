"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { env } from "@/config/env";
import { parsePesos } from "@/lib/money";
import { OrderError } from "@/modules/orders/errors";
import { addOrderNote, assignOrder, updateOrderDetails } from "@/modules/orders/order";
import { addOrderItem, removeOrderItem, updateOrderItem } from "@/modules/orders/items";
import { recordPayment, recordRefund } from "@/modules/payments/record";
import { voidPayment, voidRefund } from "@/modules/payments/void";
import { reserveDbcCards, returnCardToStock, handOverOrder, shipOrder, updateShipment } from "@/modules/orders/fulfillment";
import { cancelOrder } from "@/modules/orders/cancel";
import { allocateDbcCards } from "@/modules/orders/allocation";
import { correctShipmentDate, markJntShipped, saveJntDelivery } from "@/modules/orders/jnt-fulfillment";
import type { ActionState } from "../../inventory/actions";

const id = z.uuid();

export async function allocateAvailableStockAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  const auth = await authorize("owner");
  if (!auth.ok) return { error: "You aren't allowed to do that." };
  const parsed = z.object({ orderId: id }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Check the form and try again." };
  try {
    const result = await allocateDbcCards(db, { ...parsed.data, actorId: auth.viewer.accountId, secrets: { lookupSecret: env.activationCodeSecret, activeKeyId: env.activationCodeEncryptionActiveKeyId, encryptionKeys: env.activationCodeEncryptionKeys } });
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    revalidatePath("/admin/inventory");
    return { ok: result.allocatedCardIds.length ? `${result.allocatedCardIds.length} cards assigned. ${result.missingQuantity} still need stock.` : "No stock available yet. Receive stock and try again." };
  } catch (error) {
    if (error instanceof OrderError) return { error: "Stock changed. Reload the order and try again." };
    throw error;
  }
}

async function run<S extends z.ZodType>(schema: S, data: FormData, act: (input: z.output<S>, actorId: string) => Promise<unknown>, options: { forbidden?: string[]; invalid?: string; locked?: string } = {}): Promise<ActionState> {
  const auth = await authorize("owner");
  if (!auth.ok) return { error: "You aren't allowed to do that." };
  if (options.forbidden?.some((field) => data.has(field))) return { error: "Check the form and try again." };
  const parsed = schema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Check the form and try again." };
  try {
    await act(parsed.data, auth.viewer.accountId);
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${data.get("orderId")}`);
    return { ok: "Saved." };
  } catch (error) {
    if (error instanceof RangeError) return { error: "Check the amount. Use pesos with at most two decimal places." };
    if (error instanceof OrderError && error.code === "balance_exceeded") return { error: "Payment exceeds the current balance. Reload the order and check the amount." };
    if (error instanceof OrderError && error.code === "refund_exceeded") return { error: "Refund exceeds the net amount paid. Reload the order and check the amount." };
    if (error instanceof OrderError && error.code === "already_voided") return { error: "That entry was already voided. Reload the order." };
    if (error instanceof OrderError && error.code === "card_unavailable") return { error: "A selected DBC is no longer available for this action. Reload the order." };
    if (error instanceof OrderError && error.code === "checks_incomplete") return { error: "Finish preparing every card for this order first." };
    if (error instanceof OrderError && error.code === "settlement_mismatch") return { error: "The recorded payments no longer match this order. Correct the payment history first, then mark it as shipped." };
    if (error instanceof OrderError && error.code === "delivery_locked" && options.locked) return { error: options.locked };
    if (error instanceof OrderError && error.code === "invalid_input" && options.invalid) return { error: options.invalid };
    if (error instanceof OrderError && error.code === "nothing_reserved") return { error: "Reserve a DBC first, or confirm an undelivered GRC sale." };
    if (error instanceof OrderError && error.code === "wrong_delivery") return { error: "Choose the matching delivery method before handing over or shipping." };
    if (error instanceof OrderError && error.code === "already_released") return { error: "An order cannot be cancelled after a DBC release or commercial delivery." };
    if (error instanceof OrderError) return { error: error.code === "delivery_locked" ? "Delivery method is locked after release or delivery." : error.code === "items_delivered" ? "Delivered GRC quantities cannot change. You can still edit prices and references." : error.code === "item_full" ? "Quantity cannot be below the reserved or released DBC count." : error.code === "item_has_cards" ? "This item has linked Card history and cannot be removed." : error.code === "last_item" ? "An order must keep at least one item." : error.code === "no_product" ? "Set up this product in Settings first." : error.code === "wrong_status" ? "This action isn't available for the order's current status. Reload the order." : "Check the order details and try again." };
    throw error;
  }
}

export async function assignOrderAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, assignedToAccountId: id }), data, (input, actorId) => assignOrder(db, { ...input, actorId }));
}

export async function addOrderNoteAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, note: z.string().trim().min(1).max(500) }), data, (input, actorId) => addOrderNote(db, { ...input, actorId }));
}

export async function updateOrderDetailsAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, deliveryMethod: z.enum(["pickup", "local_handoff", "courier"]), shippingFee: z.string().trim().max(30), notes: z.string().trim().max(500) }), data, (input, actorId) => updateOrderDetails(db, { ...input, actorId, shippingFee: input.shippingFee ? parsePesos(input.shippingFee) : 0 }));
}

const itemFields = {
  orderId: id, quantity: z.coerce.number().int().min(1).max(500), agreedTotal: z.string().trim().max(30),
  label: z.string().trim().max(100).optional(), reviewUrl: z.string().trim().max(2048).optional(),
};
const lineInput = (input: z.output<z.ZodObject<typeof itemFields>>) => ({ ...input, agreedTotal: input.agreedTotal ? parsePesos(input.agreedTotal) : null, label: input.label || undefined, reviewUrl: input.reviewUrl || undefined });

export async function addOrderItemAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ ...itemFields, kind: z.enum(["dbc", "grc"]) }), data, (input, actorId) => {
    if (input.kind === "dbc") throw new OrderError("wrong_status");
    return addOrderItem(db, { ...lineInput(input), kind: input.kind, actorId });
  });
}

export async function updateOrderItemAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ ...itemFields, orderItemId: id }), data, (input, actorId) => updateOrderItem(db, { ...lineInput(input), orderItemId: input.orderItemId, actorId }));
}

export async function removeOrderItemAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, orderItemId: id, confirm: z.literal("on") }), data, (input, actorId) => removeOrderItem(db, { ...input, actorId }));
}

const optionalDate = z.preprocess((value) => value === "" ? undefined : value, z.iso.date().optional());
const method = z.enum(["gcash", "maya", "maribank", "gotyme", "bank_transfer", "cash"]);

export async function recordPaymentAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, amount: z.string().trim().max(30), method, paidOn: optionalDate, reference: z.string().trim().max(100).optional() }), data, (input, actorId) => recordPayment(db, { ...input, actorId, amount: input.amount ? parsePesos(input.amount) : undefined }));
}

export async function recordRefundAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, amount: z.string().trim().min(1).max(30), method, refundedOn: optionalDate, reason: z.string().trim().max(500).optional(), confirm: z.literal("on") }), data, (input, actorId) => recordRefund(db, { ...input, actorId, amount: parsePesos(input.amount) }));
}

export async function voidPaymentAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, paymentId: id, reason: z.string().trim().min(1).max(200), confirm: z.literal("on") }), data, (input, actorId) => voidPayment(db, { ...input, actorId }));
}

export async function voidRefundAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, refundId: id, reason: z.string().trim().min(1).max(200), confirm: z.literal("on") }), data, (input, actorId) => voidRefund(db, { ...input, actorId }));
}

export async function reserveDbcCardsAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, orderItemId: id, cardIds: z.preprocess(() => data.getAll("cardId"), z.array(id).min(1).max(500)) }), data, (input, actorId) => reserveDbcCards(db, { ...input, actorId }));
}

export async function returnCardToStockAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, cardId: id, confirm: z.literal("on") }), data, (input, actorId) => returnCardToStock(db, { ...input, actorId }));
}

export async function handOverOrderAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, confirm: z.literal("on") }), data, (input, actorId) => handOverOrder(db, { ...input, actorId }));
}

const shippingFields = { orderId: id, courier: z.string().trim().max(100), trackingNumber: z.string().trim().max(100), courierCost: z.string().trim().max(30) };

export async function shipOrderAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ ...shippingFields, shippedOn: optionalDate, recipientName: z.string().trim().max(100), recipientContact: z.string().trim().max(100), address: z.string().trim().max(500), confirm: z.literal("on") }), data, (input, actorId) => shipOrder(db, { ...input, actorId, courierCost: input.courierCost ? parsePesos(input.courierCost) : undefined }));
}

export async function updateShipmentAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ ...shippingFields, shipmentId: id, status: z.enum(["in_transit", "delivered", "failed", "returned", "lost"]) }).extend({ courier: z.string().trim().max(100).optional() }), data, (input, actorId) => updateShipment(db, { ...input, actorId, courierCost: input.courierCost ? parsePesos(input.courierCost) : null }));
}

export async function cancelOrderAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, reason: z.string().trim().max(500).optional(), confirm: z.literal("on") }), data, (input, actorId) => cancelOrder(db, { ...input, actorId }));
}

const optionalFee = z.string().trim().max(30);
// A shipping fee of zero is valid (no charge); parsePesos rightly rejects zero for payments.
const pesosOrUndefined = (value: string) => !value ? undefined : /^0+(?:\.0{1,2})?$/.test(value) ? 0 : parsePesos(value);
// The payment method and courier belong to the order and server; a form that names them is refused.
const JNT_LOCKED = "Complete the J&T details first: this order is already shipped or has more than one pending shipment, so they cannot be changed here.";
const SERVER_OWNED = ["method", "paymentMethod", "amount", "paid", "paidNow", "courier", "unitPrice"];

export async function saveJntDeliveryAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, recipientName: z.string().trim().min(1).max(100), recipientPhone: z.string().trim().min(1).max(100), address: z.string().trim().min(1).max(500), shippingFee: optionalFee.optional() }), data,
    (input, actorId) => saveJntDelivery(db, { ...input, actorId, shippingFee: pesosOrUndefined(input.shippingFee ?? "") }), { forbidden: SERVER_OWNED, locked: JNT_LOCKED, invalid: "Check the recipient details and shipping fee." });
}

export async function markJntShippedAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, trackingNumber: z.string().trim().min(1).max(100), shippedOn: optionalDate, shippingFee: optionalFee.optional() }), data,
    (input, actorId) => markJntShipped(db, { orderId: input.orderId, actorId, trackingNumber: input.trackingNumber, shippedOn: input.shippedOn, shippingFee: pesosOrUndefined(input.shippingFee ?? "") }),
    { forbidden: SERVER_OWNED, locked: JNT_LOCKED, invalid: "Check the destination details, tracking number and shipping fee. The shipped date cannot be in the future or before the order was created." });
}

export async function correctShipmentDateAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ orderId: id, shipmentId: id, shippedOn: z.iso.date(), reason: z.string().trim().min(1).max(200) }), data, (input, actorId) => correctShipmentDate(db, { ...input, actorId }), { invalid: "Enter a valid date and a reason." });
}
