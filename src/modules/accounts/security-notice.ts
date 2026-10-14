import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import * as s from "@/db/schema";
import type { EmailSender } from "@/integrations/email/resend";
import { securityNoticeEmail, type NoticeKind } from "@/integrations/email/support-templates";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { withCase } from "../support/case";
import { SupportError } from "../support/errors";

export type SecurityNotice = { accountId: string; caseId?: string; actorId: string | null; kind: NoticeKind; attemptId: string; at: Date; recipients: { to: string; slot: "old" | "new" | "current" }[] };
export async function sendSecurityNotice(db: Db, input: SecurityNotice, send: EmailSender) {
  try {
    await db.transaction(async tx => {
      await tx.select({ id: s.accounts.id }).from(s.accounts).where(eq(s.accounts.id, input.accountId)).for("no key update");
      for (const recipient of input.recipients) {
        const note = `${input.kind} ${input.attemptId} ${recipient.slot}`;
        const [previous] = await tx.select({ id: s.activityEvents.id }).from(s.activityEvents).where(and(eq(s.activityEvents.accountId, input.accountId), eq(s.activityEvents.note, note), inArray(s.activityEvents.type, ["security_notice_sent", "security_notice_failed"])));
        if (previous) continue;
        let sent = true;
        try { await send({ to: recipient.to, ...securityNoticeEmail(input.kind, input.at, input.caseId), idempotencyKey: `security-${input.accountId}-${input.kind}-${input.attemptId}-${recipient.slot}` }); }
        catch { sent = false; }
        await recordActivity(tx, { type: sent ? "security_notice_sent" : "security_notice_failed", actorAccountId: input.actorId, accountId: input.accountId, supportCaseId: input.caseId, note });
      }
    });
  } catch { /* A committed security change must remain successful if notice persistence fails. */ }
}

export async function resendCaseSecurityNotice(db: Db, input: { caseId: string; actorId: string; eventId: string }, send: EmailSender) {
  const notice = await withCase(db, { ...input, requireActive: false }, async (tx, support) => {
    const [event] = await tx.select().from(s.activityEvents).where(and(eq(s.activityEvents.id, input.eventId), eq(s.activityEvents.supportCaseId, support.id), eq(s.activityEvents.type, "security_notice_failed")));
    if (!event || !event.accountId || !event.note?.startsWith("account_secured ")) throw new SupportError("invalid_input");
    const [account] = await tx.select({ email: s.accounts.email }).from(s.accounts).where(eq(s.accounts.id, event.accountId));
    if (!account) throw new SupportError("not_found");
    return { accountId: event.accountId, email: account.email, at: event.createdAt };
  });
  await sendSecurityNotice(db, { accountId: notice.accountId, caseId: input.caseId, actorId: input.actorId, kind: "account_secured", attemptId: crypto.randomUUID(), at: notice.at, recipients: [{ to: notice.email, slot: "current" }] }, send);
}
