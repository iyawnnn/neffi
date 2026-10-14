import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/db/schema";
import type { EmailSender } from "@/integrations/email/resend";
import { acknowledgementEmail, caseMessageEmail } from "@/integrations/email/support-templates";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { lockCase } from "./case";
import { containsActivationCode } from "./credentials";
import { replySchema } from "./domain";
import { SupportError } from "./errors";

export type CaseEmailKind = "acknowledgement" | "reply" | "resolution";
export async function caseRecipient(db: Db, row: Pick<typeof s.supportCases.$inferSelect, "requesterEmail" | "accountId">): Promise<string | null> {
  if (row.requesterEmail) return row.requesterEmail;
  if (!row.accountId) return null;
  const [account] = await db.select({ email: s.accounts.email }).from(s.accounts).where(eq(s.accounts.id, row.accountId));
  return account?.email ?? null;
}

export async function dispatchCaseEmail(db: Db, input: { caseId: string; actorId: string | null; kind: CaseEmailKind; attemptId: string; body?: string }, send: EmailSender, replyTo?: string): Promise<"sent" | "failed"> {
  if (!z.enum(["acknowledgement", "reply", "resolution"]).safeParse(input.kind).success || !z.uuid().safeParse(input.attemptId).success) throw new SupportError("invalid_input");
  if (input.kind !== "acknowledgement") {
    if (!replySchema.safeParse({ body: input.body, attemptId: input.attemptId }).success) throw new SupportError("invalid_input");
    if (containsActivationCode(input.body!)) throw new SupportError("activation_code_in_email");
  }
  return db.transaction(async tx => {
    const row = await lockCase(tx, input.caseId);
    const note = `${input.kind} ${input.attemptId}`;
    const [previous] = await tx.select({ type: s.activityEvents.type }).from(s.activityEvents).where(and(eq(s.activityEvents.supportCaseId, row.id), eq(s.activityEvents.note, note), inArray(s.activityEvents.type, ["support_email_sent", "support_email_failed"])));
    if (previous) return previous.type === "support_email_sent" ? "sent" : "failed";
    const to = await caseRecipient(tx, row);
    if (!to) throw new SupportError("recipient_missing");
    const template = input.kind === "acknowledgement" ? acknowledgementEmail(row.id, row.createdAt) : caseMessageEmail(input.kind, input.body!.trim());
    let result: "sent" | "failed" = "sent";
    try {
      await send({ to, ...template, replyTo, idempotencyKey: `case-${row.id}-${input.kind}-${input.attemptId}` });
    } catch { result = "failed"; }
    await recordActivity(tx, { type: result === "sent" ? "support_email_sent" : "support_email_failed", actorAccountId: input.actorId, supportCaseId: row.id, note });
    return result;
  });
}
