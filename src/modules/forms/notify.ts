import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { EmailMessage } from "../../integrations/email/layout";
import type { EmailSender } from "../../integrations/email/resend";
import type { Db } from "../db";
import type { Answer } from "./config";
import { consumeQuota, hmacHex, QUOTA_RETENTION_MS } from "@/auth/otp-quota";

const NOTIFICATIONS_PER_PROFILE_DAY = 50;

export function submissionEmail(input: { profileName: string | null; formTitle: string; answers: Answer[]; submissionId: string; canReply: boolean }): EmailMessage {
  return {
    subject: "New message from your Neffi",
    preheader: "Someone used your contact form. Open your Neffi inbox to read the message.",
    heading: "New message from your Neffi",
    paragraphs: [`Someone sent a message through "${input.formTitle}" on ${input.profileName ?? "your Neffi"}.`],
    details: input.answers.map(({ label, value }) => ({ label, value })),
    action: { label: "Open inbox", path: `/app/inbox/${input.submissionId}` },
    ...(input.canReply ? { notes: ["Reply to this email to answer them directly."] } : {}),
    reason: "You're receiving this because someone used the contact form on your Neffi profile.",
  };
}

// The submission is already stored (D12). Email is a courtesy: one attempt, deduplicated by Resend, never thrown.
export async function notifySubmission(db: Db, send: EmailSender, input: { submissionId: string; replyTo: string | null; secret: string }): Promise<void> {
  try {
    const [row] = await db
      .select({ profileId: schema.formSubmissions.profileId, answers: schema.formSubmissions.answers, notifiedAt: schema.formSubmissions.notifiedAt, formTitle: schema.formDefinitions.title, profileName: schema.profiles.fullName, to: schema.accounts.email })
      .from(schema.formSubmissions)
      .innerJoin(schema.formDefinitions, eq(schema.formDefinitions.id, schema.formSubmissions.formId))
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.formSubmissions.profileId))
      .innerJoin(schema.accounts, eq(schema.accounts.id, schema.profiles.accountId))
      .where(eq(schema.formSubmissions.id, input.submissionId));
    if (!row || row.notifiedAt) return;
    if (!await consumeQuota(db, hmacHex(input.secret, "form-notify-profile", row.profileId), NOTIFICATIONS_PER_PROFILE_DAY, new Date(), { windowMs: QUOTA_RETENTION_MS })) return;
    const email = submissionEmail({ ...row, answers: row.answers as Answer[], submissionId: input.submissionId, canReply: Boolean(input.replyTo) });
    await send({ to: row.to, ...email, replyTo: input.replyTo ?? undefined, idempotencyKey: `form-submission-${input.submissionId}` });
    await db.update(schema.formSubmissions).set({ notifiedAt: new Date() }).where(and(eq(schema.formSubmissions.id, input.submissionId), isNull(schema.formSubmissions.notifiedAt)));
  } catch {
    // Nothing about the visitor or the message is logged; the Inbox still shows it.
    console.error("Form notification failed");
  }
}
