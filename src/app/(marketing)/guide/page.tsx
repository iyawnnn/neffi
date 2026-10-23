import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketingNextStep, MarketingPageHeader, MarketingQuestions } from "../marketing-page";
import { SectionDivider } from "../section-divider";
import { PackageContents } from "./package-contents";
import "./guide.css";

export const metadata: Metadata = {
  title: "Neffi — Setup guide",
  description: "From opening your Neffi package to publishing your profile. A plain-language guide to activation, setup, tapping and QR sharing.",
};

const activationSteps = [
  { title: "Open activation.", copy: "Scan the activation QR on your package insert, or go to the activation page. The QR opens the page; it does not identify your card." },
  { title: "Enter your activation code.", copy: "Type the private code printed inside your package. Keep it to yourself. You do not need to tap the card to activate it." },
  { title: "Sign in, then add your card.", copy: "Use Google or an email sign-in code. Check the account shown, then choose “Add to my account”. You can now continue to profile setup." },
];

export default function GuidePage() {
  return (
    <main className="mp-page guide-page">
      <MarketingPageHeader />
      <section className="mp-section guide-hero" aria-labelledby="guide-title">
        <div className="mp-container guide-hero-grid">
          <div>
            <h1 id="guide-title" className="mp-title">From the box to your first tap.</h1>
            <p className="mp-lead">Activate your card, make your profile yours, and share it when you meet. You can do it all in your browser.</p>
            <div className="mp-actions">
              <Link href="/activate" className="mp-button mp-button-primary">Start activation</Link>
              <a href="#in-the-package" className="mp-button mp-button-secondary">Walk me through it</a>
            </div>
          </div>
          <figure className="guide-hero-art">
            <PackageContents />
            <figcaption>One card. A few clear steps. Your profile, ready to share.</figcaption>
          </figure>
        </div>
      </section>

      <section id="in-the-package" className="mp-section guide-package-section" aria-labelledby="package-heading">
        <div className="mp-container guide-reading-grid">
          <h2 id="package-heading" className="mp-heading">Start with your package.</h2>
          <div>
            <dl className="guide-contents">
              <div><dt>Your Neffi card</dt><dd>The physical card you’ll tap to share your profile.</dd></div>
              <div><dt>The activation insert</dt><dd>Its QR takes you to activation. The same QR is used across packages.</dd></div>
              <div><dt>Your private activation code</dt><dd>The unique code inside the sealed package connects this card to your account.</dd></div>
            </dl>
            <p className="guide-note">The package QR is for setup. Use the separate Sharing QR from your card’s page when you want to share your profile.</p>
          </div>
        </div>
      </section>
      <SectionDivider />

      <section id="activation" className="mp-section" aria-labelledby="activate-heading">
        <div className="mp-container guide-chapter">
          <div className="guide-chapter-copy">
            <h2 id="activate-heading" className="mp-heading">First, make the card yours.</h2>
            <ol className="guide-instructions">
              {activationSteps.map(({ title, copy }) => <li key={title}><h3>{title}</h3><p>{copy}</p></li>)}
            </ol>
            <Link href="/activate" className="mp-text-link">Open activation <span aria-hidden>→</span></Link>
          </div>
          <Image src="/marketing/setup/neffi-setup-activate.svg" alt="" width={600} height={420} unoptimized className="guide-scene" />
        </div>
      </section>
      <SectionDivider />

      <section id="your-profile" className="mp-section" aria-labelledby="profile-heading">
        <div className="mp-container guide-chapter guide-chapter-reverse">
          <div className="guide-chapter-copy">
            <h2 id="profile-heading" className="mp-heading">Add the things you want to share.</h2>
            <div className="mp-copy">
              <p>In your account, find your card under <strong>Ready to set up</strong>. Choose a goal: Networking / Professional, Freelance / Creative, Business / Sales, or Student / Job Seeking. Not sure yet is fine too. Your goal suggests a starting layout; you can choose any layout and content, and change them later.</p>
              <p>Add your name and the essentials: a short introduction, contact details, and a useful link. Preview your profile, then publish it so people can open it.</p>
              <p>You can add more links, socials, and work from your profile editor later. Start with what someone needs after meeting you.</p>
            </div>
            <Link href="/sign-in" className="mp-text-link">Sign in to continue setup <span aria-hidden>→</span></Link>
          </div>
          <Image src="/marketing/setup/neffi-setup-profile-builder.svg" alt="" width={700} height={420} unoptimized className="guide-scene" />
        </div>
      </section>
      <SectionDivider />

      <section id="start-sharing" className="mp-section" aria-labelledby="sharing-heading">
        <div className="mp-container guide-chapter">
          <div className="guide-chapter-copy">
            <h2 id="sharing-heading" className="mp-heading">Ready for the next introduction.</h2>
            <div className="mp-copy">
              <p><strong>To tap:</strong> hold your card near the phone’s NFC reading area. Its location varies by phone. Open the link notification to view your profile in the browser.</p>
              <p><strong>To scan:</strong> open your card’s page in your Neffi account and show its Sharing QR. The other person can scan it with their camera. You can also download that QR as an SVG.</p>
              <p>The recipient doesn’t need a Neffi account or a separate app. Your profile needs to be published and the card turned on.</p>
            </div>
            <Link href="/help#sharing" className="mp-text-link">Get help with sharing <span aria-hidden>→</span></Link>
          </div>
          <Image src="/marketing/setup/neffi-setup-share.svg" alt="" width={650} height={420} unoptimized className="guide-scene" />
        </div>
      </section>

      <section className="mp-section guide-update" aria-labelledby="update-heading">
        <div className="mp-container guide-reading-grid">
          <h2 id="update-heading" className="mp-heading">New details.<br />Same card.</h2>
          <div className="mp-copy"><p>Changed your number? Finished a project? Edit your profile in your account. Your card keeps its link and opens the current published profile, so a content update doesn’t need a new physical card.</p><Link href="/product" className="mp-text-link">Explore what your profile can do <span aria-hidden>→</span></Link></div>
        </div>
      </section>
      <SectionDivider />

      <section className="mp-section" aria-labelledby="guide-questions">
        <div className="mp-container guide-reading-grid">
          <h2 id="guide-questions" className="mp-heading">A little reassurance.</h2>
          <MarketingQuestions items={[
            { question: "Does anyone need an app?", answer: <p>No separate Neffi app is needed. You set up your card in the browser, and the recipient opens your profile in theirs.</p> },
            { question: "What if I scan the package QR again?", answer: <p>It opens activation again. It doesn’t change the card you already claimed. Sign in to find your card and resume setup without entering its code again.</p> },
            { question: "Can I change my details later?", answer: <p>Yes. Edit your profile from your account. Your card’s link stays the same when you update your content.</p> },
            { question: "Can I share without NFC?", answer: <p>Yes. Show the Sharing QR from your card’s page. It opens the same profile as a tap. The package QR is for activation, not sharing.</p> },
            { question: "My activation code isn’t working. What next?", answer: <p>If you already claimed the card, <Link href="/sign-in">sign in</Link> to find it. Otherwise, <Link href="/support?topic=activation">contact support</Link> for help. Don’t send your activation code in a public message.</p> },
          ]} />
        </div>
      </section>
      <MarketingNextStep title="Your card is ready when you are." href="/activate" label="Start activation"><p>Have your package nearby. If you get stuck, <Link href="/help" className="mp-text-link">Help is here.</Link></p></MarketingNextStep>
    </main>
  );
}
