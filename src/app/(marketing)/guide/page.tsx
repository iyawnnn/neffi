import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CreditCard, Nfc, QrCode, RefreshCw, UserRoundPlus } from "lucide-react";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { baseMarketingProfile } from "../product/product-profile-fixture";
import { MarketingPageHeader } from "../marketing-page";
import { PackageContents } from "./package-contents";
import { SectionDivider } from "../section-divider";
import { FinalCtaSection } from "../final-cta-section";
import { OrderLink } from "../order-link";
import { HERO_PRIMARY_CLASS, HERO_SECONDARY_CLASS, PRIMARY_CTA_REFLECTIONS } from "../hero-cta-styles";
import { BuyingJourneySection } from "../buying-journey-section";
import "./guide.css";

export const metadata: Metadata = {
  title: "Neffi Guide — Order, Activate & Set Up",
  description: "How to order Neffi for ₱799, pay, track your J&T delivery, activate your card, build your profile and start sharing.",
};

const activationSteps = [
  { title: "Scan your package", copy: "Scan the QR on the back of your Neffi package to open activation." },
  { title: "Enter your code", copy: "Your private activation code is printed inside the package." },
  { title: "Add your Neffi", copy: "Sign in, add the card to your account, then continue to profile setup." },
];
export default function GuidePage() {
  return (
    <main className="mp-page guide-page">
      <MarketingPageHeader />
      <section className="mp-section guide-hero" aria-labelledby="guide-title">
        <div className="mp-container guide-hero-grid">
          <div>
            <p className="guide-eyebrow">Neffi guide</p>
            <h1 id="guide-title" className="mp-title">From order to first tap.</h1>
            <p className="mp-lead">Everything you need to order, activate, set up, and start sharing with Neffi.</p>
            <div className="mp-actions guide-hero-actions"><OrderLink /><a href="#activation" className={HERO_SECONDARY_CLASS}>I already have Neffi</a></div>
          </div>
          <figure className="guide-hero-art">
            <Image src="/marketing/guide/neffi-guide-hero-product.svg" alt="Neffi package with NFC card" width={680} height={520} priority unoptimized className="object-contain" />
          </figure>
        </div>
      </section>
      <SectionDivider />
      <BuyingJourneySection id="buying" />
      <SectionDivider />
      <section id="in-the-package" className="mp-section guide-arrival" aria-labelledby="package-heading">
        <div className="mp-container">
          <PackageContents />
        </div>
      </section>
      <SectionDivider />
      <section id="activation" className="mp-section" aria-labelledby="activate-heading">
        <div className="mp-container">
          <header className="guide-activation-header">
            <div>
              <p className="guide-eyebrow">Activation</p>
              <h2 id="activate-heading" className="mp-heading">Activate your Neffi<br />in 3 steps.</h2>
            </div>
            <div className="mp-actions">
              <Link href="/activate" className={`${HERO_PRIMARY_CLASS} group gap-2 px-4`}>
                {PRIMARY_CTA_REFLECTIONS}
                <span className="relative">Start activation</span>
                <ArrowRight size={18} aria-hidden="true" className="relative shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:-rotate-45 motion-safe:group-focus-visible:-rotate-45 motion-reduce:transition-none" />
              </Link>
            </div>
          </header>
          <ol className="guide-activation-storyboard">
            {activationSteps.map(({ title, copy }, index) => <li key={title}>
              <div className="guide-activation-step-heading">
                <span className="guide-activation-number" aria-hidden="true">0{index + 1}</span>
                <h3>{title}</h3>
              </div>
              <div className="guide-activation-visual">
                {index === 0 && <QrCode size={48} strokeWidth={1.25} aria-hidden="true" />}
                {index === 1 && <figure className="guide-activation-label" aria-label="Illustrative activation-code sticker">
                  <figcaption>Your activation code</figcaption>
                  <code>N8KF-42PQ</code>
                </figure>}
                {index === 2 && <UserRoundPlus size={48} strokeWidth={1.25} aria-hidden="true" />}
              </div>
              <p>{copy}</p>
            </li>)}
          </ol>
        </div>
      </section>
      <SectionDivider />
      <section id="your-profile" className="mp-section guide-setup" aria-labelledby="profile-heading">
        <div className="mp-container">
          <div className="guide-profile-story">
            <div className="guide-setup-copy">
              <h2 id="profile-heading" className="mp-heading">Make it yours.</h2>
              <p className="mp-copy">After activation, Neffi guides you through your name, photo or logo, contact details, and links. Choose a layout and colours, preview your profile, then publish when you’re ready.</p>
              <Link href="/sign-in" className="mp-text-link guide-inline-cta">Sign in to set up<ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            <div className="guide-profile-presentation">
              <div className="guide-profile-frame" role="img" aria-label="Sample Neffi Classic profile for Mika Santos">
                <div className="guide-profile-scale" inert><ProfileRenderer view={baseMarketingProfile} /></div>
              </div>
            </div>
            <section id="start-sharing" className="guide-sharing" aria-labelledby="sharing-heading">
              <h2 id="sharing-heading" className="mp-heading">Ready to share.</h2>
              <dl>
                <div>
                  <dt><Nfc size={24} strokeWidth={1.5} aria-hidden="true" />Tap</dt>
                  <dd>Hold your Neffi near a compatible phone’s NFC reading area to open your profile.</dd>
                </div>
                <div>
                  <dt><QrCode size={24} strokeWidth={1.5} aria-hidden="true" />Scan</dt>
                  <dd>Flip your Neffi over and scan the Sharing QR on the back to open your profile.</dd>
                </div>
              </dl>
              <div className="guide-sharing-footer">
                <Link href="/help#sharing" className="mp-text-link guide-inline-cta">Get help with sharing<ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            </section>
          </div>
        </div>
      </section>
      <SectionDivider />
      <section id="keep-your-card" className="mp-section guide-update" aria-labelledby="update-heading">
        <div className="mp-container">
          <h2 id="update-heading" className="mp-heading">Change your details.<br />Keep your card.</h2>
          <dl className="guide-update-facts">
            <div>
              <dt><CreditCard size={28} strokeWidth={1.5} aria-hidden="true" />Physical card</dt>
              <dd>Your physical Neffi card stays the same as your profile changes.</dd>
            </div>
            <div>
              <dt><RefreshCw size={28} strokeWidth={1.5} aria-hidden="true" />Digital profile</dt>
              <dd>Update your role, links, contact details, or work from your account.</dd>
            </div>
          </dl>
          <Link href="/product" className={`${HERO_SECONDARY_CLASS} guide-update-action`}>See what your profile can do<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
      <FinalCtaSection />
    </main>
  );
}
