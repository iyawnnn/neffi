import { NeffiLogo } from "@/components/neffi-logo";
import Link from "next/link";
import { PLATFORMS } from "@/modules/profiles/platform-registry";
import { SectionDivider } from "./section-divider";
import { FACEBOOK_ORDER_URL } from "./order-link";
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
  { label: "Facebook", href: FACEBOOK_ORDER_URL, path: PLATFORMS.facebook.brand!.path },
  { label: "Instagram", href: "https://www.instagram.com/neffi.ph", path: PLATFORMS.instagram.brand!.path },
  { label: "TikTok", href: "https://www.tiktok.com/@neffi.ph", path: PLATFORMS.tiktok.brand!.path },
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

          <section aria-labelledby="footer-follow">
            <h2 id="footer-follow" className="marketing-footer-heading">Follow Neffi</h2>
            <p className="marketing-footer-follow-copy">See what we’re building and what’s next.</p>
            <ul className="marketing-footer-socials">
              {socials.map(({ label, href, path }) => (
                <li key={label}>
                  <a href={href} aria-label={label} title={label} target="_blank" rel="noopener noreferrer" className="marketing-footer-social">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d={path} /></svg>
                  </a>
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
