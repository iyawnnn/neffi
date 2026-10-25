import { NeffiLogo } from "@/components/neffi-logo";
import Link from "next/link";
import type { ReactNode } from "react";
import "./marketing-pages.css";

export function MarketingPageHeader() {
  return (
    <header className="mp-header">
      <Link href="/" aria-label="Neffi home" className="mp-home">
        <span><NeffiLogo aria-hidden className="text-foreground" /></span>
      </Link>
    </header>
  );
}

export type MarketingQuestion = { question: string; answer: ReactNode };

export function MarketingQuestions({ items }: { items: MarketingQuestion[] }) {
  return (
    <div className="mp-questions">
      {items.map(({ question, answer }) => (
        <details key={question}>
          <summary>{question}<span aria-hidden className="mp-disclosure-mark" /></summary>
          <div className="mp-answer">{answer}</div>
        </details>
      ))}
    </div>
  );
}

export function MarketingNextStep({ title, children, href, label }: {
  title: string; children: ReactNode; href: string; label: string;
}) {
  return (
    <section className="mp-section mp-next">
      <div className="mp-container mp-next-inner">
        <div><h2 className="mp-heading">{title}</h2><div className="mp-copy">{children}</div></div>
        <Link href={href} className="mp-button mp-button-primary">{label}</Link>
      </div>
    </section>
  );
}
