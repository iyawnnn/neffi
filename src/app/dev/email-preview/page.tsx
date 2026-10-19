import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { renderEmail, type EmailMessage } from "@/integrations/email/layout";
import { authCodeEmail, changeEmailCodeEmail } from "@/integrations/email/resend";
import { acknowledgementEmail, caseMessageEmail, noticeEvents, recoveryCodeEmail, securityNoticeEmail, type NoticeKind } from "@/integrations/email/support-templates";
import { submissionEmail } from "@/modules/forms/notify";
import { PreviewFrame } from "./preview-frame";

export const metadata: Metadata = {
  title: "Email preview — development only",
  robots: { index: false, follow: false },
};
export const instant = false;

const AT = new Date("2026-10-19T07:42:00Z");
const CASE_ID = "abcdef12-0000-4000-8000-000000000000";
const BODY = "Hi Juan,\n\nWe checked your order and shipped a replacement today.\nIt should arrive in 2–3 days.";
const ANSWERS = [{ label: "Your name", value: "Juan Dela Cruz" }, { label: "Email", value: "juan@example.com" }, { label: "Message", value: "Hi, I'd like to work together.\nCan we talk this week?" }];

// Built per request, after the development guard, so a template error can never break module evaluation.
const buildEmails = (): Record<string, { label: string; message: EmailMessage }> => ({
  "sign-in": { label: "Sign-in code", message: authCodeEmail("123456", 5) },
  "sign-in-zero": { label: "Sign-in code (leading zero)", message: authCodeEmail("012345", 5) },
  "email-change": { label: "Email-change code", message: changeEmailCodeEmail("123456", 5) },
  recovery: { label: "Recovery code", message: recoveryCodeEmail("123456") },
  ...Object.fromEntries((Object.keys(noticeEvents) as NoticeKind[]).map(kind => [`notice-${kind}`, { label: `Notice: ${kind}`, message: securityNoticeEmail(kind, AT, kind.startsWith("recovery") || kind === "account_secured" ? CASE_ID : undefined) }])),
  ack: { label: "Support: request received", message: acknowledgementEmail(CASE_ID) },
  reply: { label: "Support: reply", message: caseMessageEmail("reply", BODY, CASE_ID, true) },
  resolution: { label: "Support: resolved", message: caseMessageEmail("resolution", BODY, CASE_ID, false) },
  form: { label: "New form message", message: submissionEmail({ profileName: "Juan Dela Cruz", formTitle: "Contact", answers: ANSWERS, submissionId: "11111111-1111-4111-8111-111111111111", canReply: true }) },
});

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function EmailPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development" || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development")) notFound();
  const emails = buildEmails();
  const query = await searchParams;
  const key = first(query.email) ?? "sign-in";
  const selected = Object.hasOwn(emails, key) ? key : "sign-in";
  const width = first(query.w) === "375" ? 375 : 600;
  const { subject, text, html } = renderEmail(emails[selected].message, "http://localhost:3000");

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6 text-meta">
      <p className="text-fg-secondary">Development preview · fake data only · nothing is sent</p>
      <nav aria-label="Emails" className="flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(emails).map(([id, { label }]) => (
          <Link key={id} href={`?email=${id}&w=${width}`} className={`inline-flex min-h-11 items-center underline underline-offset-4 ${id === selected ? "font-semibold" : ""}`}>{label}</Link>
        ))}
      </nav>
      <nav aria-label="Width" className="flex gap-4">
        {[375, 600].map(w => <Link key={w} href={`?email=${selected}&w=${w}`} className={`inline-flex min-h-11 items-center underline underline-offset-4 ${w === width ? "font-semibold" : ""}`}>{w}px</Link>)}
      </nav>
      <p><span className="text-fg-secondary">Subject:</span> {subject}</p>
      <PreviewFrame title={subject} html={html} width={width} />
      <pre className="whitespace-pre-wrap rounded-md border border-border bg-subtle p-4">{text}</pre>
    </div>
  );
}
