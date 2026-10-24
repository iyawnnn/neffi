import { formatDateTime } from "@/lib/format-date";
import { caseReference } from "@/modules/support/domain";
import type { EmailMessage } from "./layout";

const SUPPORT_REASON = "You're receiving this because you contacted Neffi support.";
const caseDetail = (caseId: string) => ({ label: "Case reference", value: caseReference(caseId) });

export function acknowledgementEmail(caseId: string): EmailMessage {
  return {
    subject: "We received your Neffi support request",
    preheader: "Your case reference is inside. We'll reply by email.",
    heading: "We received your request",
    paragraphs: ["Thanks for contacting Neffi support. We'll reply by email."],
    details: [caseDetail(caseId)],
    notes: ["Keep this reference if you contact us again."],
    reason: SUPPORT_REASON,
  };
}

const NOT_YOU = "If you made this change, no action is needed. If you didn't, contact Neffi support right away.";
const contactSupport = { label: "Contact support", path: "/support" } as const;
export const noticeEvents = {
  email_changed: { subject: "Your Neffi sign-in email was changed", preheader: NOT_YOU, heading: "Your sign-in email was changed", body: "The email you use to sign in to Neffi was changed.", note: NOT_YOU, action: contactSupport },
  google_connected: { subject: "Google sign-in was connected to Neffi", preheader: NOT_YOU, heading: "Google sign-in was connected", body: "You can now sign in to Neffi with Google.", note: NOT_YOU, action: contactSupport },
  google_removed: { subject: "Google sign-in was removed from Neffi", preheader: NOT_YOU, heading: "Google sign-in was removed", body: "You can still sign in with a code sent to your email.", note: NOT_YOU, action: contactSupport },
  sessions_revoked: { subject: "You were signed out of Neffi everywhere", preheader: NOT_YOU, heading: "You were signed out everywhere", body: "Your Neffi account was signed out on all devices.", note: NOT_YOU, action: contactSupport },
  recovery_started: { subject: "Recovery of your Neffi account was started", preheader: "Neffi support is moving your account to a different sign-in email. If you didn't ask for this, contact us right away.", heading: "Account recovery was started", body: "Neffi support started moving your account to a different sign-in email.", note: "If you didn't ask Neffi support for this, contact us right away.", action: contactSupport },
  recovery_completed: { subject: "Your Neffi account recovery is complete", preheader: "All devices were signed out. Sign in with your new email. If you didn't request this, contact Neffi support.", heading: "Account recovery is complete", body: "Your Neffi account now uses a different sign-in email, and all devices were signed out.", note: "Sign in with your new email. If you didn't request this, contact Neffi support.", action: { label: "Sign in", path: "/sign-in" } },
  account_secured: { subject: "Neffi support secured your account", preheader: "All devices were signed out to protect your account. Sign in again with a code sent to your email.", heading: "Neffi support secured your account", body: "We signed your Neffi account out on all devices to protect it.", note: "Sign in again with a code sent to your email.", action: undefined },
} as const;
export type NoticeKind = keyof typeof noticeEvents;
export function securityNoticeEmail(kind: NoticeKind, at: Date, caseId?: string): EmailMessage {
  const event = noticeEvents[kind];
  return {
    subject: event.subject,
    preheader: event.preheader,
    heading: event.heading,
    paragraphs: [event.body],
    details: [{ label: "When", value: `${formatDateTime(at)} (Philippine time)` }, ...(caseId ? [caseDetail(caseId)] : [])],
    ...(event.action ? { action: event.action } : {}),
    securityNotes: [event.note],
  };
}

export function recoveryCodeEmail(code: string): EmailMessage {
  return {
    subject: "Your Neffi recovery code",
    preheader: "Neffi support approved your recovery request. The code expires in 24 hours. Don't share it.",
    heading: "Complete your account recovery",
    paragraphs: ["Neffi support approved your recovery request.", "Enter this code with this email address to finish."],
    code,
    action: { label: "Complete recovery", path: "/support/recover" },
    notes: ["This code expires in 24 hours."],
    securityNotes: [
      "Don't sign in with this address until recovery is complete. It can create a separate account and block recovery.",
      "Don't share this code. Neffi support will never ask for it.",
    ],
    reason: SUPPORT_REASON,
  };
}

export function caseMessageEmail(kind: "reply" | "resolution", body: string, caseId: string, canReply: boolean): EmailMessage {
  return {
    subject: kind === "reply" ? "A message from Neffi support" : "Your Neffi support case was resolved",
    heading: kind === "reply" ? "A message from Neffi support" : "Your support case was resolved",
    paragraphs: [body],
    details: [caseDetail(caseId)],
    ...(canReply ? { notes: ["Reply to this email to answer."] } : {}),
    reason: SUPPORT_REASON,
  };
}
