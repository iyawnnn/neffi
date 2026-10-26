import "server-only";
import { z } from "zod";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { OrderError } from "../orders/errors";
import { loadOrderFacts, mutateOrder } from "../orders/order";
import { NEW_PAYMENT_METHODS } from "../orders/policy";

export const paymentInputSchema = z.object({
  amount: z.number().int().positive().max(1_000_000_000).optional(),
  method: z.enum([...NEW_PAYMENT_METHODS, "cash"]),
  paidOn: z.iso.date().optional(),
  reference: z.string().trim().max(100).optional(),
});

// shortcut: partial payments have no idempotency key; add one if duplicates occur in practice.
export async function recordPayment(db: Db, input: { orderId: string; actorId: string; supportCaseId?: string; reason?: string } & z.input<typeof paymentInputSchema>): Promise<void> {
  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) throw new OrderError("invalid_input");
  await mutateOrder(db, { ...input, allow: input.supportCaseId ? ["completed"] : ["in_progress"] }, async (tx, order) => {
    if (order.clientKey && !input.supportCaseId) throw new OrderError("wrong_status");
    const { totals } = await loadOrderFacts(tx, input.orderId);
    const amount = parsed.data.amount ?? totals.balance;
    if (totals.balance === null || amount === null || amount <= 0 || amount > totals.balance || amount > 1_000_000_000) throw new OrderError("balance_exceeded");
    await tx.insert(schema.payments).values({ orderId: input.orderId, recordedByAccountId: input.actorId, ...parsed.data, amount, reference: parsed.data.method === "cash" ? null : parsed.data.reference, paidOn: parsed.data.paidOn ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()) });
    await recordActivity(tx, { type: "payment_recorded", actorAccountId: input.actorId, orderId: input.orderId, supportCaseId: input.supportCaseId, note: `${amount} centavos; ${parsed.data.method}${input.supportCaseId ? `; ${input.reason}` : ""}` });
  });
}

const refundInputSchema = paymentInputSchema.omit({ paidOn: true, reference: true }).extend({
  amount: z.number().int().positive().max(1_000_000_000), refundedOn: z.iso.date().optional(), reason: z.string().trim().max(500).optional(),
});

export async function recordRefund(db: Db, input: { orderId: string; actorId: string; supportCaseId?: string } & z.input<typeof refundInputSchema>): Promise<void> {
  const parsed = refundInputSchema.safeParse(input);
  if (!parsed.success) throw new OrderError("invalid_input");
  if (input.supportCaseId && !z.string().trim().min(1).max(200).safeParse(input.reason).success) throw new OrderError("invalid_input");
  await mutateOrder(db, { ...input, allow: input.supportCaseId ? ["completed"] : ["in_progress", "cancelled"] }, async (tx) => {
    const { totals } = await loadOrderFacts(tx, input.orderId);
    if (parsed.data.amount > totals.netPaid) throw new OrderError("refund_exceeded");
    await tx.insert(schema.refunds).values({ orderId: input.orderId, recordedByAccountId: input.actorId, supportCaseId: input.supportCaseId, ...parsed.data, refundedOn: parsed.data.refundedOn ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()) });
    await recordActivity(tx, { type: "refund_recorded", actorAccountId: input.actorId, orderId: input.orderId, supportCaseId: input.supportCaseId, note: `${parsed.data.amount} centavos; ${parsed.data.method}${input.supportCaseId ? `; ${parsed.data.reason}` : ""}` });
  });
}
