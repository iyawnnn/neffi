import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { EmailSender } from "../../integrations/email/resend";
import type { Db } from "../db";
import type { Answer } from "./config";

export function submissionEmail(input: { profileName: string | null; formTitle: string; answers: Answer[]; link: string; canReply: boolean }) {
  const lines = input.answers.map((answer) => `${answer.label}: ${answer.value}`).join("\n");
  return {
    subject: "New message from your Neffi",
    text: [
      `Someone sent a message through "${input.formTitle}" on ${input.profileName ?? "your Neffi"}.`,
      lines,
      `See it in your Neffi inbox: ${input.link}`,
      ...(input.canReply ? ["Reply to this email to answer them directly."] : []),
    ].join("\n\n"),
  };
}

// The submission is already stored (D12). Email is a courtesy: one attempt, deduplicated by Resend, never thrown.
export async function notifySubmission(db: Db, send: EmailSender, input: { submissionId: string; appOrigin: string; replyTo: string | null }): Promise<void> {
  try {
    const [row] = await db
      .select({ answers: schema.formSubmissions.answers, notifiedAt: schema.formSubmissions.notifiedAt, formTitle: schema.formDefinitions.title, profileName: schema.profiles.fullName, to: schema.accounts.email })
      .from(schema.formSubmissions)
      .innerJoin(schema.formDefinitions, eq(schema.formDefinitions.id, schema.formSubmissions.formId))
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.formSubmissions.profileId))
      .innerJoin(schema.accounts, eq(schema.accounts.id, schema.profiles.accountId))
      .where(eq(schema.formSubmissions.id, input.submissionId));
    if (!row || row.notifiedAt) return;
    const email = submissionEmail({ ...row, answers: row.answers as Answer[], link: `${input.appOrigin}/app/inbox/${input.submissionId}`, canReply: Boolean(input.replyTo) });
    await send({ to: row.to, ...email, replyTo: input.replyTo ?? undefined, idempotencyKey: `form-submission-${input.submissionId}` });
    await db.update(schema.formSubmissions).set({ notifiedAt: new Date() }).where(and(eq(schema.formSubmissions.id, input.submissionId), isNull(schema.formSubmissions.notifiedAt)));
  } catch {
    // Nothing about the visitor or the message is logged; the Inbox still shows it.
    console.error("Form notification failed");
  }
}
