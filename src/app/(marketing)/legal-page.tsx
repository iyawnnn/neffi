import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingPageHeader } from "./marketing-page";
import "./legal.css";

export type LegalSection = { id: string; title: string; body: ReactNode };

export function LegalPage({ title, introduction, updated, sections }: {
  title: string; introduction: string; updated: { label: string; iso: string }; sections: LegalSection[];
}) {
  return (
    <main className="mp-page legal-page">
      <MarketingPageHeader />
      <article className="legal-document">
        <header className="legal-header">
          <p className="legal-eyebrow">Legal</p>
          <h1 className="legal-title">{title}</h1>
          <p className="legal-lead">{introduction}</p>
          <p className="legal-updated">Last updated <time dateTime={updated.iso}>{updated.label}</time></p>
        </header>
        {sections.map(({ id, title: sectionTitle, body }, index) => (
          <section id={id} key={id} aria-labelledby={`${id}-heading`} className="legal-section">
            <p className="legal-number" aria-hidden>{String(index + 1).padStart(2, "0")}</p>
            <h2 id={`${id}-heading`}>{sectionTitle}</h2>
            <div className="legal-prose">{body}</div>
          </section>
        ))}
        <aside className="legal-help">
          <h2>Questions about this page?</h2>
          <p>Email <MailLink address="support@getneffi.com" /> for help with your account, card or order, or <MailLink address="privacy@getneffi.com" /> for privacy requests.</p>
          <Link href="/support" className="mp-text-link">Contact support <span aria-hidden>→</span></Link>
        </aside>
      </article>
    </main>
  );
}

export function LegalCallout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="legal-callout">
      <p className="legal-callout-title">{title}</p>
      {children}
    </aside>
  );
}

export const MailLink = ({ address }: { address: string }) => <a href={`mailto:${address}`}>{address}</a>;
