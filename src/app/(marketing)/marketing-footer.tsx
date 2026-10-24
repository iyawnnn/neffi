import { Mail } from "lucide-react";
import { NeffiLogo } from "@/components/neffi-logo";
import Link from "next/link";
import { PLATFORMS } from "@/modules/profiles/platform-registry";
import { SectionDivider } from "./section-divider";
import "./marketing-footer.css";

type FooterItem = { label: string; href?: string };

const navigationGroups: { title: string; id: string; items: FooterItem[] }[] = [
  {
    title: "Explore",
    id: "footer-explore",
    items: [{ label: "Home", href: "/" }, { label: "Product", href: "/product" }, { label: "Guide", href: "/guide" }, { label: "Pricing", href: "/pricing" }],
  },
  {
    title: "Neffi",
    id: "footer-neffi",
    items: [
      { label: "Activate your card", href: "/activate" },
      { label: "Sign in", href: "/sign-in" },
      { label: "Help", href: "/help" },
      { label: "Support", href: "/support" },
    ],
  },
];

const socials = [
  { label: "Instagram", path: PLATFORMS.instagram.brand!.path },
  { label: "TikTok", path: PLATFORMS.tiktok.brand!.path },
  { label: "Facebook", path: PLATFORMS.facebook.brand!.path },
  { label: "Email", path: undefined },
];

export function MarketingFooter() {
  return (
    <footer aria-label="Neffi" className="marketing-footer">
      <SectionDivider />
      <div className="marketing-footer-container">
        <div className="marketing-footer-groups">
          {navigationGroups.map(({ title, id, items }) => (
            <nav key={id} aria-labelledby={id}>
              <h2 id={id} className="marketing-footer-heading">{title}</h2>
              <ul className="marketing-footer-links">
                {items.map(({ label, href }) => (
                  <li key={label}>
                    {href ? (
                      <Link href={href} className="marketing-footer-link">{label}</Link>
                    ) : (
                      <span className="marketing-footer-link">{label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <section aria-labelledby="footer-newsletter">
            <h2 id="footer-newsletter" className="marketing-footer-heading">Stay in the loop</h2>
            <p className="marketing-footer-newsletter-copy">Updates from Neffi, only when there’s something worth sharing.</p>
            {/* Visual preview until subscription infrastructure exists; no form or submission action. */}
            <div role="group" aria-label="Newsletter preview" aria-describedby="footer-newsletter-preview" className="marketing-footer-newsletter">
              <label htmlFor="footer-newsletter-email" className="sr-only">Email address</label>
              <input id="footer-newsletter-email" type="email" placeholder="Email address" readOnly />
              <button type="button" disabled>Subscribe</button>
            </div>
            <p id="footer-newsletter-preview" className="sr-only">Newsletter preview. Subscriptions are not available yet.</p>
            {/* No official accounts yet, so the icons are labelled but not links. */}
            <ul className="marketing-footer-socials">
              {socials.map(({ label, path }) => (
                <li key={label}>
                  <span role="img" aria-label={label} title={label} className="marketing-footer-social">
                    {path ? (
                      <svg aria-hidden viewBox="0 0 24 24" fill="currentColor"><path d={path} /></svg>
                    ) : (
                      <Mail aria-hidden strokeWidth={1.7} />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="marketing-footer-legal">
          <Link href="/terms" className="marketing-footer-link marketing-footer-legal-link marketing-footer-terms">Terms &amp; Conditions</Link>
          <p className="marketing-footer-copyright">© 2026 Neffi. All rights reserved.</p>
          <Link href="/privacy" className="marketing-footer-link marketing-footer-legal-link marketing-footer-privacy">Privacy Policy</Link>
        </div>

        <div aria-hidden className="marketing-footer-monument">
          <div className="marketing-footer-wordmark">
            <NeffiLogo className="marketing-footer-wordmark-image" />
          </div>
        </div>
      </div>
    </footer>
  );
}
