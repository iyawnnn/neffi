import "server-only";
import { z } from "zod";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { OrderError } from "../orders/errors";
import { loadOrderFacts, mutateOrder } from "../orders/order";

export const paymentInputSchema = z.object({
  amount: z.number().int().positive().max(1_000_000_000).optional(),
  method: z.enum(["gcash", "bank_transfer", "cash"]),
  paidOn: z.iso.date().optional(),
  reference: z.string().trim().max(100).optional(),
});

export async function recordPayment(db: Db, input: { orderId: string; actorId: string } & z.input<typeof paymentInputSchema>): Promise<void> {
  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) throw new OrderError("invalid_input");
  await mutateOrder(db, input, async (tx) => {
    const { totals } = await loadOrderFacts(tx, input.orderId);
    const amount = parsed.data.amount ?? totals.balance;
    if (amount <= 0 || amount > totals.balance || amount > 1_000_000_000) throw new OrderError("balance_exceeded");
    await tx.insert(schema.payments).values({ orderId: input.orderId, recordedByAccountId: input.actorId, ...parsed.data, amount, reference: parsed.data.method === "cash" ? null : parsed.data.reference, paidOn: parsed.data.paidOn ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()) });
    await recordActivity(tx, { type: "payment_recorded", actorAccountId: input.actorId, orderId: input.orderId, note: `${amount} centavos; ${parsed.data.method}` });
  });
}
