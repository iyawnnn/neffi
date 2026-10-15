import { caseReference, RECOVERY_INSTRUCTION } from "@/modules/support/domain";
import type { Email } from "./resend";

type Template = Pick<Email, "subject" | "text">;
const contact = "Contact Neffi support at /support if you need help.";
const context = (at: Date, caseId?: string) => `Time: ${at.toISOString()}${caseId ? `\nCase: ${caseReference(caseId)}` : ""}\n\n${contact}`;
export function acknowledgementEmail(caseId: string, at: Date): Template {
  return { subject: "Neffi support received your request", text: `Your support request was received.\n\n${context(at, caseId)}` };
}
export const noticeEvents = {
  email_changed: "Your Neffi sign-in email changed.",
  google_connected: "Google sign-in was connected to your Neffi Account.",
  google_removed: "Google sign-in was removed from your Neffi Account.",
  sessions_revoked: "Your Neffi Account was signed out everywhere.",
  recovery_started: "Recovery of your Neffi Account was started.",
  recovery_completed: "Recovery of your Neffi Account was completed.",
  account_secured: "Neffi support secured your Account.",
} as const;
export type NoticeKind = keyof typeof noticeEvents;
export function securityNoticeEmail(kind: NoticeKind, at: Date, caseId?: string): Template {
  return { subject: "Neffi account security notice", text: `${noticeEvents[kind]}\n\n${context(at, caseId)}` };
}
export function recoveryCodeEmail(code: string, at: Date): Template {
  return { subject: "Complete your Neffi account recovery", text: `Your one-time recovery code is ${code}. It expires in 24 hours.\n\nEnter it at /support/recover. ${RECOVERY_INSTRUCTION}\n\n${context(at)}` };
}
export function caseMessageEmail(kind: "reply" | "resolution", body: string): Template {
  return { subject: kind === "reply" ? "A message from Neffi support" : "Your Neffi support case was resolved", text: `${body}\n\n${contact}` };
}
