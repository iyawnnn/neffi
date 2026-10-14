import "server-only";
import { z } from "zod";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import { activeProduct, CardError } from "../cards/card";
import type { Db } from "../db";
import { paymentInputSchema, recordPayment } from "../payments/record";
import { OrderError } from "./errors";
import { resolvePurchaser } from "./purchasers";
import { withCase } from "../support/case";

const amount = z.number().int().nonnegative().max(1_000_000_000);
export const orderLineSchema = z.object({
  kind: z.enum(["dbc", "grc"]), quantity: z.number().int().positive().max(500),
  agreedTotal: amount.nullish(), label: z.string().trim().max(100).optional(),
  reviewUrl: z.url({ protocol: /^https$/ }).max(2048).optional(),
}).refine((line) => line.kind === "grc" || (!line.label && !line.reviewUrl));

export const createOrderSchema = z.object({
  supportCaseId: z.uuid().optional(),
  purchaserId: z.uuid().optional(),
  purchaser: z.object({ name: z.string().trim().min(1).max(100), contactNumber: z.string().trim().max(100).optional() }).optional(),
  items: z.array(orderLineSchema).min(1).max(50),
  deliveryMethod: z.enum(["pickup", "local_handoff", "courier"]).optional(),
  shippingFee: amount.default(0), notes: z.string().trim().max(500).optional(),
  paidNow: paymentInputSchema.optional(),
}).refine((input) => Boolean(input.purchaserId) !== Boolean(input.purchaser));

export async function createOrder(db: Db, input: { actorId: string } & Record<string, unknown>): Promise<{ orderId: string }> {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) throw new OrderError("invalid_input");
  const data = parsed.data;
  const create = async (tx: Db) => {
    const purchaserId = await resolvePurchaser(tx, data);
    const [order] = await tx.insert(schema.orders).values({ purchaserId, deliveryMethod: data.deliveryMethod, shippingFee: data.shippingFee, notes: data.notes, createdByAccountId: input.actorId, assignedToAccountId: input.actorId, updatedByAccountId: input.actorId }).returning({ id: schema.orders.id });
    for (const line of data.items) {
      const product = await activeProduct(tx, line.kind).catch((error) => {
        if (error instanceof CardError && error.code === "no_product") throw new OrderError("no_product");
        throw error;
      });
      await tx.insert(schema.orderItems).values({ orderId: order.id, productId: product.id, productKind: line.kind, quantity: line.quantity, unitPrice: product.price, agreedTotal: line.agreedTotal, label: line.label, reviewUrl: line.reviewUrl });
    }
    await recordActivity(tx, { type: "order_created", actorAccountId: input.actorId, orderId: order.id });
    if (data.supportCaseId) await recordActivity(tx, { type: "support_order_linked", actorAccountId: input.actorId, orderId: order.id, supportCaseId: data.supportCaseId });
    if (data.paidNow) await recordPayment(tx, { orderId: order.id, actorId: input.actorId, ...data.paidNow });
    return { orderId: order.id };
  };
  return data.supportCaseId ? withCase(db, { caseId: data.supportCaseId, actorId: input.actorId }, create) : db.transaction(create);
}
