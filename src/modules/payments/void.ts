import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { OrderError } from "../orders/errors";
import { mutateOrder } from "../orders/order";

type VoidInput = { orderId: string; actorId: string; reason: string; supportCaseId?: string };

async function voidMoney(db: Db, input: VoidInput & { rowId: string }, kind: "payment" | "refund"): Promise<void> {
  if (!input.reason.trim() || input.reason.length > 200) throw new OrderError("invalid_input");
  await mutateOrder(db, { ...input, allow: input.supportCaseId ? ["completed"] : kind === "payment" ? ["in_progress"] : ["in_progress", "cancelled"] }, async (tx) => {
    const table = kind === "payment" ? schema.payments : schema.refunds;
    const [row] = await tx.select({ id: table.id, voidedAt: table.voidedAt }).from(table).where(and(eq(table.id, input.rowId), eq(table.orderId, input.orderId), kind === "refund" ? input.supportCaseId ? eq(schema.refunds.supportCaseId, input.supportCaseId) : isNull(schema.refunds.supportCaseId) : undefined));
    if (!row) throw new OrderError("not_found");
    if (row.voidedAt) throw new OrderError("already_voided");
    await tx.update(table).set({ voidedAt: new Date(), voidedByAccountId: input.actorId, voidReason: input.reason.trim() }).where(eq(table.id, row.id));
    await recordActivity(tx, { type: kind === "payment" ? "payment_voided" : "refund_voided", actorAccountId: input.actorId, orderId: input.orderId, supportCaseId: input.supportCaseId, note: input.reason.trim() });
  });
}

export async function voidPayment(db: Db, input: VoidInput & { paymentId: string }): Promise<void> {
  return voidMoney(db, { ...input, rowId: input.paymentId }, "payment");
}

export async function voidRefund(db: Db, input: VoidInput & { refundId: string }): Promise<void> {
  return voidMoney(db, { ...input, rowId: input.refundId }, "refund");
}
