"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sendEmail } from "@/integrations/email/sender";
import { prepareCaseMessage, dispatchCaseEmail } from "@/modules/support/email";
import { initiateRecovery, cancelRecovery, resendRecoveryNotice } from "@/modules/accounts/recovery";
import { secureAccount } from "@/modules/accounts/secure";
import { recoveryInitiationSchema, verificationSchema } from "@/modules/support/domain";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { openCase, assignCase, setCaseStatus, reopenCase, addCaseNote, fillCaseLink, linkCaseCard, openCaseSchema } from "@/modules/support/case";
import { SupportError, type SupportErrorCode } from "@/modules/support/errors";
import { OrderError } from "@/modules/orders/errors";
import { CardError } from "@/modules/cards/card";
import type { ActionState } from "../../inventory/actions";
import { env } from "@/config/env";
import { parsePesos } from "@/lib/money";
import { formatActivationCode } from "@/modules/activation/code";
import { afterSaleRefund, voidAfterSaleRefund, voidCompletedPayment, recordCompletedPayment } from "@/modules/support/money";
import { retireAffectedCard, releaseReplacementCard, reissueActivationCode, resetCardOwnership } from "@/modules/support/cards";
import { recordSupportShipment, updateSupportShipment } from "@/modules/support/shipments";

const MESSAGES: Record<SupportErrorCode, string> = {
  customer_required: "Link a customer Account. Owner Accounts cannot be recovered or secured here.",
  email_taken: "That email belongs to an Account. Recovery cannot merge Accounts; use another address and keep this case open.",
  recovery_live: "Cancel the live pending recovery before initiating another.",
  recovery_pending: "Cancel the pending recovery before resolving this case.",
  recipient_missing: "Link an Account or use a case with a requester email before sending.",
  activation_code_in_email: "Remove the activation code; give it to the customer directly",
  not_found: "That record was not found. Reload the case and try again.", invalid_input: "Check the fields and try again.",
  case_resolved: "This case is resolved. Reopen it before making a correction.", link_exists: "That link is already set and cannot be changed. Reload the case.",
  order_required: "Link an order to this case first.", wrong_order: "This action must use the order linked to this case.", wrong_status: "This action is unavailable for the order's current status.",
  card_unavailable: "That card is unavailable for this action. Reload the case.", card_claimed: "This card is already claimed. Use Reset ownership after verification.", card_unclaimed: "This card is unclaimed. Use Issue new code after verification.",
  card_not_linked: "Link this card to the case first.", replacement_unavailable: "Retire an affected card through this case first. Each retired card allows one replacement, within the original item quantity.", checks_incomplete: "The replacement needs a package match and an unused activation credential.",
};
const id = z.uuid();
const note = z.string().trim().min(1).max(500);
const optionalId = z.preprocess((v) => v === "" ? undefined : v, id.optional());

async function run<S extends z.ZodType>(schema: S, data: FormData, act: (input: z.output<S>, actorId: string) => Promise<ActionState | void>): Promise<ActionState> {
  const auth = await authorize("owner");
  if (!auth.ok) return { error: "You aren't allowed to do that." };
  const parsed = schema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Check the form and try again." };
  try {
    const result = await act(parsed.data, auth.viewer.accountId);
    for (const path of ["/admin", "/admin/support", "/admin/orders", "/admin/inventory", "/admin/expenses"]) revalidatePath(path);
    const fields = parsed.data as { caseId?: string; orderId?: string; cardId?: string };
    if (fields.caseId) revalidatePath(`/admin/support/${fields.caseId}`);
    if (fields.orderId) revalidatePath(`/admin/orders/${fields.orderId}`);
    else if (fields.caseId) revalidatePath("/admin/orders/[orderId]", "page");
    if (fields.cardId) revalidatePath(`/admin/inventory/cards/${fields.cardId}`);
    return result ?? { ok: "Saved." };
  } catch (error) {
    if (error instanceof SupportError) return { error: MESSAGES[error.code] };
    if (error instanceof RangeError) return { error: "Check the amount. Use pesos with at most two decimal places." };
    if (error instanceof OrderError) return { error: error.code === "balance_exceeded" ? "Payment exceeds the current balance. Reload the case and check the amount." : error.code === "refund_exceeded" ? "Refund exceeds the net amount paid. Reload the case and check the amount." : error.code === "already_voided" ? "That entry was already voided. Reload the case." : "That order action is unavailable. Reload the case and check the order's status." };
    if (error instanceof CardError) return { error: "That card is unavailable. Reload the case." };
    throw error;
  }
}

export async function openCaseAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  const schema = openCaseSchema.extend({ purchaserId: optionalId, accountId: optionalId, orderId: optionalId, cardId: optionalId, assignedToAccountId: optionalId });
  const result = await run(schema, data, async (input, actorId) => {
    const { caseId } = await openCase(db, { ...input, actorId });
    return { href: `/admin/support/${caseId}` };
  });
  if (result.href) redirect(result.href);
  return result;
}

export async function assignCaseAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ caseId: id, assignedToAccountId: id }), data, (input, actorId) => assignCase(db, { ...input, actorId }));
}

export async function sendCaseMessageAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ caseId: id, kind: z.enum(["reply", "resolution", "acknowledgement"]), attemptId: id, body: z.string().trim().max(2000).optional(), resend: z.preprocess(value => value === "on", z.boolean()) }), data, async (input, actorId) => {
    await prepareCaseMessage(db, { ...input, actorId });
    after(async () => {
      try { await dispatchCaseEmail(db, { ...input, actorId }, sendEmail, env.supportReplyTo); }
      catch { /* Status is persisted; delivery is best effort. */ }
    });
    return { ok: "Saved. Check the Activity timeline for the delivery result." };
  });
}

const accountVerified = verificationSchema.extend({ caseId: id, confirmed: z.preprocess(value => value === "on", z.literal(true)), unlinkGoogle: z.preprocess(value => value === "on", z.boolean()) });
export async function initiateRecoveryAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(accountVerified.extend({ newEmail: recoveryInitiationSchema.shape.newEmail }), data, async (input, actorId) => {
    await initiateRecovery(db, { ...input, actorId, secret: env.betterAuthSecret }, sendEmail);
    return { ok: "Recovery started. Check Activity for delivery. Do not sign in with the proposed new address before completion." };
  });
}
export async function cancelRecoveryAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ caseId: id, recoveryId: id }), data, (input, actorId) => cancelRecovery(db, { ...input, actorId }));
}
export async function secureAccountAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(accountVerified, data, (input, actorId) => secureAccount(db, { ...input, actorId }, sendEmail));
}
export async function resendRecoveryNoticeAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ caseId: id, recoveryId: id, kind: z.enum(["recovery_started", "recovery_completed"]) }), data, (input, actorId) => resendRecoveryNotice(db, { ...input, actorId }, sendEmail));
}

export async function setCaseStatusAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ caseId: id, status: z.enum(["open", "waiting_on_customer", "resolved"]), note: z.string().trim().max(500).optional() }), data, (input, actorId) => setCaseStatus(db, { ...input, actorId }));
}

export async function reopenCaseAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ caseId: id }), data, (input, actorId) => reopenCase(db, { ...input, actorId }));
}

export async function addCaseNoteAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ caseId: id, note }), data, (input, actorId) => addCaseNote(db, { ...input, actorId }));
}

export async function fillCaseLinkAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ caseId: id, field: z.enum(["purchaserId", "accountId", "orderId"]), value: id }), data, (input, actorId) => fillCaseLink(db, { ...input, actorId }));
}

export async function linkCaseCardAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(z.object({ caseId: id, cardId: id }), data, (input, actorId) => linkCaseCard(db, { ...input, actorId }));
}

const reason = z.string().trim().min(1).max(200);
const controlled = z.object({ caseId: id, reason, confirm: z.literal("on") });
const money = controlled.extend({ orderId: id, amount: z.string().trim().min(1).max(30), method: z.enum(["cash", "gcash", "bank_transfer"]) });
const date = z.preprocess((v) => v === "" ? undefined : v, z.iso.date().optional());
const optional = (max: number) => z.preprocess((v) => v === "" ? undefined : v, z.string().trim().max(max).optional());

export async function afterSaleRefundAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(money.extend({ refundedOn: date }), data, (input, actorId) => afterSaleRefund(db, { ...input, actorId, amount: parsePesos(input.amount) }));
}

export async function recordCompletedPaymentAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(money.extend({ paidOn: date, reference: optional(100) }), data, (input, actorId) => recordCompletedPayment(db, { ...input, actorId, amount: parsePesos(input.amount) }));
}

export async function voidAfterSaleRefundAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(controlled.extend({ orderId: id, refundId: id }), data, (input, actorId) => voidAfterSaleRefund(db, { ...input, actorId }));
}

export async function voidCompletedPaymentAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(controlled.extend({ orderId: id, paymentId: id }), data, (input, actorId) => voidCompletedPayment(db, { ...input, actorId }));
}

export async function retireAffectedCardAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(controlled.extend({ cardId: id }), data, (input, actorId) => retireAffectedCard(db, { ...input, actorId }));
}

export async function releaseReplacementCardAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(controlled.extend({ cardId: id, orderItemId: id }), data, (input, actorId) => releaseReplacementCard(db, { ...input, actorId }));
}

const verified = z.object({ caseId: id, cardId: id, verificationNote: note, confirm: z.literal("on") });

export async function reissueActivationCodeAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(verified, data, async (input, actorId) => {
    const { activationCode } = await reissueActivationCode(db, { ...input, actorId, activationSecret: env.activationCodeSecret });
    return { reveal: { code: formatActivationCode(activationCode), instructions: "Copy it now and deliver it to the verified requester outside Neffi. This code cannot be shown again after closing or leaving this page." } };
  });
}

export async function resetCardOwnershipAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(verified, data, async (input, actorId) => {
    const { activationCode } = await resetCardOwnership(db, { ...input, actorId, activationSecret: env.activationCodeSecret });
    return { reveal: { code: formatActivationCode(activationCode), instructions: "Copy it now and deliver it to the verified requester outside Neffi. The card stays offline until it is claimed and connected to a Profile. This code cannot be shown again after closing or leaving this page." } };
  });
}

const cost = z.preprocess((v) => v === "" || v == null ? undefined : v, z.string().max(30).optional());
const shipment = controlled.extend({ courier: optional(100), trackingNumber: optional(100), courierCost: cost });

export async function recordSupportShipmentAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(shipment.extend({ shippedOn: date, recipientName: optional(100), recipientContact: optional(100), address: optional(500) }), data, (input, actorId) => recordSupportShipment(db, { ...input, actorId, courierCost: input.courierCost ? parsePesos(input.courierCost) : undefined }));
}

export async function updateSupportShipmentAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(shipment.extend({ shipmentId: id, status: z.enum(["in_transit", "delivered", "failed", "returned", "lost"]) }), data, (input, actorId) => updateSupportShipment(db, { ...input, actorId, courierCost: input.courierCost ? parsePesos(input.courierCost) : null }));
}
