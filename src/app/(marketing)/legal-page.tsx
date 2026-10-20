import Link from "next/link";
import { MarketingPageHeader } from "./marketing-page";
import "./legal.css";

export type LegalSection = { id: string; title: string; requiredCopy: string };

export function LegalPage({ title, introduction, sections }: {
  title: string; introduction: string; sections: LegalSection[];
}) {
  return (
    <main className="mp-page legal-page">
      <MarketingPageHeader />
      <header className="mp-section legal-header">
        <div className="mp-container">
          <h1 className="mp-title">{title}</h1>
          <p className="mp-lead">{introduction}</p>
          <div className="legal-status" role="note">
            <h2>Not yet published</h2>
            <p>This is a review template. Neffi’s approved {title} has not been added. The outline below is not a statement of legal terms or data practices.</p>
          </div>
        </div>
      </header>

      <div className="mp-section legal-body">
        <div className="mp-container legal-columns">
          <nav aria-label={`${title} contents`} className="legal-contents">
            <p>On this page</p>
            <ul>{sections.map(({ id, title: sectionTitle }) => <li key={id}><a href={`#${id}`}>{sectionTitle}</a></li>)}</ul>
          </nav>
          <div className="legal-reading">
            {sections.map(({ id, title: sectionTitle, requiredCopy }) => (
              <section id={id} key={id} aria-labelledby={`${id}-heading`}>
                <h2 id={`${id}-heading`}>{sectionTitle}</h2>
                <p className="legal-pending">Approved copy required</p>
                <p>{requiredCopy}</p>
              </section>
            ))}
            <aside className="legal-help">
              <h2>Need help with Neffi?</h2>
              <p>For help with a card or account, use the existing support page.</p>
              <Link href="/support" className="mp-text-link">Contact support <span aria-hidden>→</span></Link>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
