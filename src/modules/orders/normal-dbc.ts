import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { CredentialSecrets } from "../activation/encryption";
import { activeProduct, CardError } from "../cards/card";
import type { Db } from "../db";
import { withCase } from "../support/case";
import { allocateDbcCardsInTransaction, allocationDeficit, type AllocationResult } from "./allocation";
import { OrderError } from "./errors";
import { NEW_PAYMENT_METHODS, NORMAL_DBC_UNIT_PRICE, type NewPaymentMethod, type OwnerDelivery } from "./policy";
import { resolvePurchaser } from "./purchasers";

export type NormalDbcOrderInput = {
  actorId: string; clientKey: string; quantity: number; paymentMethod: NewPaymentMethod;
  purchaserId?: string; purchaser?: { name: string; contactNumber?: string };
  delivery: { method: OwnerDelivery; recipientName?: string; recipientPhone?: string; address?: string; shippingFee?: number };
  notes?: string; supportCaseId?: string; secrets: CredentialSecrets;
};

const money = z.number().int().min(0).max(1_000_000_000);
const inputSchema = z.strictObject({
  actorId: z.uuid(), clientKey: z.uuid(), quantity: z.number().int().min(1).max(500),
  paymentMethod: z.enum(NEW_PAYMENT_METHODS),
  purchaserId: z.uuid().optional(),
  purchaser: z.strictObject({ name: z.string().trim().min(1).max(100), contactNumber: z.string().trim().max(100).optional() }).optional(),
  delivery: z.strictObject({ method: z.enum(["in_person", "jnt"]), recipientName: z.string().trim().max(100).optional(), recipientPhone: z.string().trim().max(100).optional(), address: z.string().trim().max(500).optional(), shippingFee: money.optional() }),
  notes: z.string().trim().max(500).optional(), supportCaseId: z.uuid().optional(),
  secrets: z.custom<CredentialSecrets>((value) => typeof value === "object" && value !== null && typeof (value as CredentialSecrets).lookupSecret === "string" && (value as CredentialSecrets).encryptionKeys instanceof Map),
}).refine((input) => Boolean(input.purchaserId) !== Boolean(input.purchaser))
  .refine((input) => input.delivery.method === "jnt" || input.delivery.shippingFee === undefined || input.delivery.shippingFee === 0)
  .refine((input) => input.quantity * NORMAL_DBC_UNIT_PRICE + (input.delivery.shippingFee ?? 0) <= 1_000_000_000);

export async function createPaidDbcOrder(db: Db, input: NormalDbcOrderInput): Promise<{ orderId: string; allocation: AllocationResult }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new OrderError("invalid_input");
  const data = parsed.data;

  const create = async (tx: Db) => {
    const [actor] = await tx.select({ id: schema.accounts.id }).from(schema.accounts).where(sql`${schema.accounts.id} = ${data.actorId} and ${schema.accounts.role} = 'owner'`);
    if (!actor) throw new OrderError("invalid_input");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.clientKey}))`);
    const [existing] = await tx.select({ id: schema.orders.id, createdByAccountId: schema.orders.createdByAccountId }).from(schema.orders).where(eq(schema.orders.clientKey, data.clientKey));
    if (existing) {
      if (existing.createdByAccountId !== data.actorId) throw new OrderError("invalid_input");
      return { orderId: existing.id, allocation: { allocatedCardIds: [], missingQuantity: await allocationDeficit(tx, existing.id) } };
    }

    const purchaserId = await resolvePurchaser(tx, data);
    const [order] = await tx.insert(schema.orders).values({
      purchaserId, clientKey: data.clientKey, normalPaymentMethod: data.paymentMethod,
      deliveryMethod: data.delivery.method === "jnt" ? "courier" : "local_handoff",
      shippingFee: data.delivery.shippingFee ?? 0,
      shippingFeePending: data.delivery.method === "jnt" && data.delivery.shippingFee === undefined,
      notes: data.notes, createdByAccountId: data.actorId, assignedToAccountId: data.actorId, updatedByAccountId: data.actorId,
    }).returning({ id: schema.orders.id });
    const product = await activeProduct(tx, "dbc").catch((error) => {
      if (error instanceof CardError && error.code === "no_product") throw new OrderError("no_product");
      throw error;
    });
    await tx.insert(schema.orderItems).values({ orderId: order.id, productId: product.id, productKind: "dbc", quantity: data.quantity, unitPrice: NORMAL_DBC_UNIT_PRICE });
    if (data.delivery.method === "jnt") await tx.insert(schema.shipments).values({ orderId: order.id, courier: "J&T", recipientName: data.delivery.recipientName, recipientContact: data.delivery.recipientPhone, address: data.delivery.address });
    await tx.insert(schema.payments).values({ orderId: order.id, amount: NORMAL_DBC_UNIT_PRICE * data.quantity, method: data.paymentMethod, paidOn: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()), recordedByAccountId: data.actorId });
    await recordActivity(tx, { type: "order_created", actorAccountId: data.actorId, orderId: order.id });
    await recordActivity(tx, { type: "payment_recorded", actorAccountId: data.actorId, orderId: order.id, note: `${NORMAL_DBC_UNIT_PRICE * data.quantity} centavos; ${data.paymentMethod}` });
    if (data.supportCaseId) await recordActivity(tx, { type: "support_order_linked", actorAccountId: data.actorId, orderId: order.id, supportCaseId: data.supportCaseId });
    const allocation = await allocateDbcCardsInTransaction(tx, { actorId: data.actorId, orderId: order.id, secrets: data.secrets });
    return { orderId: order.id, allocation };
  };

  const [actor] = await db.select({ id: schema.accounts.id }).from(schema.accounts).where(sql`${schema.accounts.id} = ${data.actorId} and ${schema.accounts.role} = 'owner'`);
  if (!actor) throw new OrderError("invalid_input");
  const [prior] = await db.select({ id: schema.orders.id, createdByAccountId: schema.orders.createdByAccountId }).from(schema.orders).where(eq(schema.orders.clientKey, data.clientKey));
  if (prior) {
    if (prior.createdByAccountId !== data.actorId) throw new OrderError("invalid_input");
    return { orderId: prior.id, allocation: { allocatedCardIds: [], missingQuantity: await allocationDeficit(db, prior.id) } };
  }
  return data.supportCaseId ? withCase(db, { caseId: data.supportCaseId, actorId: data.actorId }, create) : db.transaction(create);
}
