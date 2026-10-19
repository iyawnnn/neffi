import Link from "next/link";
import { ArrowLeft, Building2, Mail, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { ButtonLink } from "@/components/app-ui";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format-date";
import { openSubmission, unreadCount } from "@/modules/forms/submissions";
import { FIELD_LABELS } from "@/modules/forms/fields";
import { MessageActions } from "./message-actions";

export const instant = false;

export default async function MessagePage({ params }: PageProps<"/app/inbox/[submissionId]">) {
  const viewer = await requireAccount("/app");
  const { submissionId } = await params;
  const message = await openSubmission(db, { accountId: viewer.accountId, submissionId });
  if (!message) notFound();
  const unread = await unreadCount(db, viewer.accountId);
  const label = (value: string) => value.trim().toLowerCase();
  const nameIndex = message.answers.findIndex(answer => ["name", FIELD_LABELS.name.toLowerCase()].includes(label(answer.label)) && answer.value.trim());
  const sender = message.answers[nameIndex]?.value.trim() || message.replyEmail || "Unknown sender";
  const messages = message.answers.filter(answer => label(answer.label) === "message");
  const contacts = message.answers.filter(answer => ["email", "phone", "company"].includes(label(answer.label)));
  const additional = message.answers.filter((answer, index) => index !== nameIndex && !["message", "email", "phone", "company"].includes(label(answer.label)));
  return (
    <main data-canvas className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 pb-10 md:gap-8 md:px-6 md:pt-8 md:pb-12">
      <Link href="/app/inbox" className="inline-flex min-h-11 items-center gap-2 self-start rounded-md text-meta text-fg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"><ArrowLeft aria-hidden className="size-4" />Back to Inbox</Link>
      <article className="min-w-0 rounded-panel border bg-background p-4 sm:p-6 md:p-8">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-title wrap-anywhere">{sender}</h1>
            {message.replyEmail ? <p className="mt-1.5 text-body wrap-anywhere text-fg-secondary">{message.replyEmail}</p> : null}
            <p className="mt-1.5 text-meta wrap-anywhere text-fg-secondary">{message.formTitle} · <time dateTime={message.createdAt.toISOString()}>{formatDateTime(message.createdAt)}</time></p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {message.replyEmail ? <ButtonLink variant="outline" href={`mailto:${message.replyEmail}`}><Mail aria-hidden className="size-4" />Reply by email</ButtonLink> : null}
            <MessageActions submissionId={message.id} sender={sender} unread={unread} />
          </div>
        </header>
        {messages.length ? <section aria-labelledby="message-title" className="py-6">
          <h2 id="message-title" className="text-section">Message</h2>
          <div className="mt-3 flex max-w-prose flex-col gap-4 rounded-lg bg-canvas p-4 sm:p-5">{messages.map((answer, index) => <p key={index} className="text-base leading-7 whitespace-pre-wrap wrap-anywhere">{answer.value}</p>)}</div>
        </section> : null}
        {contacts.length ? <section aria-labelledby="contact-title" className={`py-6 ${messages.length ? "border-t" : ""}`}>
          <h2 id="contact-title" className="text-section">Contact details</h2>
          <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">{contacts.map((answer, index) => {
            const Icon = label(answer.label) === "email" ? Mail : label(answer.label) === "phone" ? Phone : Building2;
            const href = label(answer.label) === "email" ? `mailto:${answer.value}` : label(answer.label) === "phone" && /^\+?[0-9 ()-]{7,20}$/.test(answer.value) ? `tel:${answer.value.replace(/[ ()-]/g, "")}` : null;
            const content = <>
              <Icon aria-hidden className="size-4 shrink-0 text-fg-secondary" strokeWidth={1.75} />
              <dl className="min-w-0 flex-1">
                <dt className="text-label text-fg-secondary">{answer.label}</dt>
                <dd className="text-body font-medium whitespace-pre-wrap wrap-anywhere group-hover:underline">{answer.value}</dd>
              </dl>
            </>;
            return href ? <Link key={index} href={href} className="group flex min-h-11 min-w-0 items-start gap-2 rounded-sm underline-offset-4 focus-visible:outline-2 focus-visible:outline-brand">{content}</Link> : <div key={index} className="flex min-h-11 min-w-0 items-start gap-2">{content}</div>;
          })}</div>
        </section> : null}
        {additional.length ? <section aria-labelledby="additional-title" className={`py-6 ${messages.length || contacts.length ? "border-t" : ""}`}>
          <h2 id="additional-title" className="text-section">Additional details</h2>
          <dl className="mt-4 flex max-w-prose flex-col gap-5">{additional.map((answer, index) => <div key={index}><dt className="text-label text-fg-secondary">{answer.label}</dt><dd className="mt-1 text-body leading-6 whitespace-pre-wrap wrap-anywhere">{answer.value}</dd></div>)}</dl>
        </section> : null}
      </article>
    </main>
  );
}
