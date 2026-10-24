import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PREVIEW_THEME_ATTRIBUTE, renderEmail, type EmailMessage } from "@/integrations/email/layout";
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
type Theme = "light" | "dark";

function Choice({ href, selected, children }: { href: string; selected: boolean; children: ReactNode }) {
  return <Link href={href} aria-current={selected ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-md border px-3 ${selected ? "border-foreground bg-foreground text-background" : "border-border hover:bg-subtle"}`}>{children}</Link>;
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return <nav aria-label={label} className="flex flex-wrap items-center gap-2"><span className="w-20 shrink-0 text-fg-secondary">{label}</span>{children}</nav>;
}

export default async function EmailPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development" || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development")) notFound();
  const emails = buildEmails();
  const query = await searchParams;
  const key = first(query.email) ?? "sign-in";
  const selected = Object.hasOwn(emails, key) ? key : "sign-in";
  const width = first(query.w) === "375" ? 375 : 600;
  const theme: Theme = first(query.theme) === "dark" ? "dark" : "light";
  const href = (next: { email?: string; w?: number; theme?: Theme }) => `?email=${next.email ?? selected}&w=${next.w ?? width}&theme=${next.theme ?? theme}`;
  // The dev server's own origin, so the logos load whichever port it runs on.
  const { subject, text, html } = renderEmail(emails[selected].message, `http://${(await headers()).get("host") ?? "localhost:3000"}`);
  const preheader = emails[selected].message.preheader;
  // The same rendered HTML, pinned to one theme: the attribute turns on the email's own dark rules, and the OS
  // media query is switched off so a dark OS can't override Light.
  const themed = html.replace('<html lang="en">', `<html lang="en" ${PREVIEW_THEME_ATTRIBUTE}="${theme}">`).replace("@media (prefers-color-scheme:dark)", "@media not all");

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-6 text-meta">
      <p className="text-fg-secondary">Development preview · fake data only · nothing is sent</p>
      <div className="flex flex-col gap-3">
        <Control label="Scenario">{Object.entries(emails).map(([id, { label }]) => <Choice key={id} href={href({ email: id })} selected={id === selected}>{label}</Choice>)}</Control>
        <Control label="Theme">{(["light", "dark"] as const).map(t => <Choice key={t} href={href({ theme: t })} selected={t === theme}>{t === "light" ? "Light" : "Dark"}</Choice>)}</Control>
        <Control label="Width">{[375, 600].map(w => <Choice key={w} href={href({ w })} selected={w === width}>{w}px</Choice>)}</Control>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        <dt className="text-fg-secondary">Subject</dt><dd>{subject}</dd>
        <dt className="text-fg-secondary">Preheader</dt><dd>{preheader ?? <span className="text-fg-secondary">None</span>}</dd>
      </dl>
      <section aria-label="Email preview" className="flex flex-col gap-2">
        <h2 className="font-semibold">Email preview</h2>
        <PreviewFrame title={subject} html={themed} width={width} />
      </section>
      <section aria-label="Notification preview" className="flex flex-col gap-2">
        <h2 className="font-semibold">Notification preview — approximate</h2>
        <div data-notification className="w-full max-w-[360px] rounded-xl border border-border bg-subtle p-3">
          <div className="flex justify-between"><span className="font-semibold">Neffi</span><span className="text-fg-secondary">now</span></div>
          <p className="truncate font-medium">{subject}</p>
          <p className="line-clamp-2 text-fg-secondary">{preheader ?? "No preheader. The mail app takes the snippet from the body text."}</p>
        </div>
        <p className="text-fg-secondary">Sender name, subject and preheader only. The mail app decides wrapping, truncation, the icon and the avatar.</p>
      </section>
      <section aria-label="Plain-text output" className="flex flex-col gap-2">
        <h2 className="font-semibold">Plain-text output</h2>
        <pre className="whitespace-pre-wrap rounded-md border border-border bg-subtle p-4">{text}</pre>
      </section>
    </div>
  );
}
