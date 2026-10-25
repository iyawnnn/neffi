import type { Metadata } from "next";
import Link from "next/link";
import { Check, CreditCard, QrCode, RefreshCw, UserRound } from "lucide-react";
import { MarketingPageHeader } from "../marketing-page";
import { SectionDivider } from "../section-divider";
import { FinalCtaSection } from "../final-cta-section";
import { FACEBOOK_ORDER_URL, OrderLink } from "../order-link";
import { HERO_SECONDARY_CLASS } from "../hero-cta-styles";
import { BuyingJourneySection } from "../buying-journey-section";
import { ProductGallery } from "./product-gallery";
import "./pricing.css";

export const metadata: Metadata = {
  title: "Neffi Pricing — Digital Business Card for ₱799",
  description: "Get a physical Neffi NFC card and an editable digital profile for ₱799. Order on Facebook, confirm payment, and track your J&T delivery.",
};

const inclusions = [
  { icon: CreditCard, title: "Physical Neffi NFC card", copy: "Tap the card on a compatible phone to open your digital profile." },
  { icon: UserRound, title: "Your digital profile", copy: "Add your identity, contact details, links, socials, work, and more." },
  { icon: RefreshCw, title: "Update it anytime", copy: "Change what people see without replacing your physical card." },
  { icon: QrCode, title: "Tap or share your QR", copy: "Tap your Neffi with NFC, or use the Sharing QR printed on the back of the card." },
];

export default function PricingPage() {
  return (
    <main className="mp-page pricing-page">
      <MarketingPageHeader />
      <section className="mp-section pricing-hero" aria-labelledby="pricing-title">
        <div className="mp-container pricing-hero-grid">
          <ProductGallery />
          <div className="pricing-hero-copy">
            <h1 id="pricing-title" className="mp-title">Neffi Digital Business Card</h1>
            <p className="pricing-price">₱799</p>
            <p className="pricing-tagline">One tap. Instant connection.</p>
            <p className="mp-lead">A physical NFC card connected to a digital profile you can update anytime.</p>
            <div className="pricing-hero-includes">
              <h2>Includes</h2>
              <ul>
                <li><Check size={16} strokeWidth={1.75} aria-hidden="true" />Neffi NFC card</li>
                <li><Check size={16} strokeWidth={1.75} aria-hidden="true" />Editable digital profile</li>
              </ul>
            </div>
            <div className="mp-actions pricing-actions">
              <OrderLink />
              <Link href="/product" className={HERO_SECONDARY_CLASS}>See product details</Link>
            </div>
            <p className="pricing-shipping-note">Delivery details and any applicable shipping fee are confirmed before payment.</p>
          </div>
        </div>
      </section>
      <SectionDivider />

      <section className="mp-section" aria-labelledby="included-heading">
        <div className="mp-container pricing-included">
          <header>
            <h2 id="included-heading" className="mp-heading">What comes<br />with your Neffi.</h2>
            <p className="mp-lead">One physical card. One editable profile. One permanent Neffi link.</p>
          </header>
          <dl className="pricing-inclusions">
            {inclusions.map(({ icon: Icon, title, copy }) => <div key={title}>
              <dt><Icon size={24} strokeWidth={1.5} aria-hidden="true" /><span>{title}</span></dt>
              <dd>{copy}</dd>
            </div>)}
          </dl>
        </div>
      </section>
      <SectionDivider />

      <BuyingJourneySection />
      <FinalCtaSection href={FACEBOOK_ORDER_URL} external />
    </main>
  );
}
