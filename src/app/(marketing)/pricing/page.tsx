import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketingNextStep, MarketingPageHeader, MarketingQuestions } from "../marketing-page";
import { SectionDivider } from "../section-divider";
import "./pricing.css";

export const metadata: Metadata = {
  title: "Neffi — Get your card",
  description: "See what comes with the Neffi Digital Business Card, how setup works, and where to ask about current pricing and ordering.",
};

const inclusions = [
  { title: "A physical NFC card", copy: "A card that opens your Neffi profile on a compatible phone." },
  { title: "Your own digital profile", copy: "A place for your identity, contact details, links, socials, and work." },
  { title: "Room to change", copy: "Edit your published profile while keeping the same card link." },
  { title: "Another way to share", copy: "A Sharing QR on your card’s page, available to show or download." },
];

export default function PricingPage() {
  return (
    <main className="mp-page pricing-page">
      <MarketingPageHeader />
      <section className="mp-section pricing-intro" aria-labelledby="pricing-title">
        <div className="mp-container">
          <h1 id="pricing-title" className="mp-title">One card.<br />Your next connection.</h1>
          <p className="mp-lead">The Neffi Digital Business Card brings the things you share into one profile. Keep it in your wallet. Make it yours online.</p>
        </div>
      </section>

      <section className="mp-section pricing-offer-section" aria-labelledby="offer-heading">
        <div className="mp-container pricing-offer">
          <figure className="pricing-product">
            <div className="pricing-product-stage">
              <div aria-hidden className="pricing-sleeve" />
              <Image src="/neffi-card-front-preview.svg" alt="The front of the physical Neffi card" width={856} height={540} priority unoptimized className="pricing-card" />
            </div>
            <figcaption>Physical card. Editable profile. One permanent link.</figcaption>
          </figure>
          <div className="pricing-offer-copy">
            <h2 id="offer-heading" className="mp-heading">Neffi<br />Digital Business Card</h2>
            <p className="mp-copy">For the introductions you want to keep going.</p>
            <div className="pricing-availability">
              <h3>Ask about current pricing.</h3>
              <p>A public price and online checkout aren’t available here yet. Contact Neffi support for buying information before placing an order.</p>
            </div>
            <Link href="/support" className="mp-button mp-button-primary">Ask about getting Neffi</Link>
            <p className="pricing-order-note">This opens a support request, not a checkout.</p>
            <Link href="/product" className="mp-text-link">Take a closer look at the product <span aria-hidden>→</span></Link>
          </div>
        </div>
      </section>
      <SectionDivider />

      <section className="mp-section" aria-labelledby="included-heading">
        <div className="mp-container pricing-included">
          <div><h2 id="included-heading" className="mp-heading">The card is only<br />the beginning.</h2><p className="mp-lead">Here’s what the Digital Business Card brings together.</p></div>
          <dl className="pricing-inclusions">
            {inclusions.map(({ title, copy }) => <div key={title}><dt>{title}</dt><dd>{copy}</dd></div>)}
          </dl>
        </div>
      </section>

      <section className="mp-section pricing-setup" aria-labelledby="pricing-setup-heading">
        <div className="mp-container">
          <div className="mp-section-intro">
            <h2 id="pricing-setup-heading" className="mp-heading">When your card arrives.</h2>
            <p className="mp-copy">Setup happens in your browser. The private code in your package gets you started.</p>
          </div>
          <ol className="pricing-start">
            <li><h3>Activate</h3><p>Enter your package code, sign in, and add the card to your account.</p></li>
            <li><h3>Make it yours</h3><p>Add the details you want to share, preview your profile, and publish.</p></li>
            <li><h3>Meet someone</h3><p>Tap on a compatible phone or show your Sharing QR. No recipient app needed.</p></li>
          </ol>
          <Link href="/guide" className="mp-text-link">See the setup guide <span aria-hidden>→</span></Link>
        </div>
      </section>
      <SectionDivider />

      <section className="mp-section" aria-labelledby="buying-questions">
        <div className="mp-container pricing-included">
          <h2 id="buying-questions" className="mp-heading">Before you decide.</h2>
          <MarketingQuestions items={[
            { question: "Can I buy through this website?", answer: <p>There is no online checkout here yet. Use <Link href="/support">Neffi support</Link> to ask about current buying information. Sending a request does not place an order.</p> },
            { question: "What should I confirm before ordering?", answer: <p>Ask Neffi about the current price, availability, delivery arrangements, and any charges that apply. This page does not quote a price or delivery fee.</p> },
            { question: "Do I need a new card when my details change?", answer: <p>No new card is needed for a profile content update. Your physical card keeps its link while you edit the digital profile it opens.</p> },
            { question: "Does the person I meet need an account?", answer: <p>No. Your published profile opens in their browser. They don’t need a Neffi account or a separate app to view it.</p> },
            { question: "Is this the same as a Google Review Card?", answer: <p>No. The Digital Business Card opens your Neffi profile. A Google Review Card is a separate product that opens a business’s Google review page directly. <Link href="/support">Ask Neffi</Link> if you need help choosing.</p> },
          ]} />
        </div>
      </section>
      <MarketingNextStep title="A useful next step after every introduction." href="/support" label="Ask about getting Neffi"><p>Ask for current pricing and buying information. Already have your card? <Link href="/activate" className="mp-text-link">Start activation.</Link></p></MarketingNextStep>
    </main>
  );
}
