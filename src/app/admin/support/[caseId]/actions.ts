"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { db } from "@/db";
import { openCase, assignCase, setCaseStatus, reopenCase, addCaseNote, fillCaseLink, linkCaseCard, openCaseSchema } from "@/modules/support/case";
import { SupportError, type SupportErrorCode } from "@/modules/support/errors";
import { OrderError } from "@/modules/orders/errors";
import { CardError } from "@/modules/cards/card";
import type { ActionState } from "../../inventory/actions";

const MESSAGES: Record<SupportErrorCode, string> = {
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
