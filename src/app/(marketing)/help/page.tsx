import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNextStep, MarketingPageHeader, MarketingQuestions, type MarketingQuestion } from "../marketing-page";
import { SectionDivider } from "../section-divider";
import "./help.css";

export const metadata: Metadata = {
  title: "Neffi — Help",
  description: "Find answers about setting up Neffi, activation, editing your profile, tap and QR sharing, sign-in, and account recovery.",
};

const topics: { id: string; title: string; description: string; questions: MarketingQuestion[] }[] = [
  {
    id: "getting-started", title: "Getting started", description: "From your package to a published profile.",
    questions: [
      { question: "Where do I start with a new card?", answer: <p>Open <Link href="/activate">activation</Link>, enter the private code inside your package, sign in, and choose “Add to my account”. Then find your card under Ready to set up. The <Link href="/guide">setup guide</Link> walks through each step.</p> },
      { question: "Do I need to install an app?", answer: <p>No separate Neffi app is required. Setup and editing happen in your browser. The person opening your published profile doesn’t need an app or a Neffi account either.</p> },
      { question: "I stopped during setup. Can I finish later?", answer: <p>Yes. If you already added the card to your account, <Link href="/sign-in">sign in</Link> and find it under Ready to set up. You don’t need the activation code to resume.</p> },
    ],
  },
  {
    id: "activation", title: "Activation", description: "Your code, your account, your card.",
    questions: [
      { question: "What is the QR in my package for?", answer: <p>It opens the activation page. It’s the same QR across packages and doesn’t contain your private activation code. Type the code from inside your sealed package when prompted.</p> },
      { question: "My code can’t be used. What should I do?", answer: <p>If you already added this card, <Link href="/sign-in">sign in</Link> to find it. Otherwise, <Link href="/support?topic=activation">contact support</Link>. Don’t post your activation code or put it in a support message.</p> },
      { question: "The wrong account is shown before I add my card.", answer: <p>Choose the option to switch account before you confirm “Add to my account”. If you already added it to the wrong account, <Link href="/support?topic=ownership">contact support</Link> for an ownership check. There is no self-service card transfer.</p> },
    ],
  },
  {
    id: "profile", title: "Your profile", description: "Edit what people see after a tap.",
    questions: [
      { question: "What can I put on my profile?", answer: <p>Your identity and contact details, links, social profiles, and work. Supported content includes About, projects, links, Save contact, booking links, and a contact form. <Link href="/product">Explore the product</Link> for a closer look.</p> },
      { question: "Can I change links or contact details later?", answer: <p>Yes. Sign in, open your profile, and edit the details you want to share. Your physical card keeps its permanent link. A content change doesn’t require a replacement card.</p> },
      { question: "What makes my profile visible to other people?", answer: <p>Your card needs to be activated, connected to a published profile, and turned on. A draft or unpublished profile isn’t available to visitors. Check your profile’s publish status and your card’s settings in your account.</p> },
    ],
  },
  {
    id: "sharing", title: "Sharing your card", description: "Tap when you meet. Scan when you need to.",
    questions: [
      { question: "How do I share with a tap?", answer: <p>Hold the card near the phone’s NFC reading area, then open the link notification. The reading area varies by device. A compatible phone and an internet connection are needed to open the web profile.</p> },
      { question: "Where is my Sharing QR?", answer: <p>Sign in and open the card’s page in your account. A claimed, connected card has a Sharing QR you can show on screen or download as an SVG. It opens the same address as the NFC tap.</p> },
      { question: "Can I use the package QR to share my profile?", answer: <p>No. The package QR opens activation. Use the Sharing QR from your card’s page to share your profile.</p> },
    ],
  },
  {
    id: "account", title: "Account & sign-in", description: "Get back to the account that owns your card.",
    questions: [
      { question: "How do I sign in?", answer: <p>Use <Link href="/sign-in">Google or a six-digit email code</Link>. Neffi does not use passwords. Make sure you use the sign-in method associated with the account that owns your card.</p> },
      { question: "I can still access my email. Can I change it?", answer: <p>Yes. <Link href="/sign-in?next=/app/account">Sign in and open Account settings</Link> to change your email and verify the new address. You may be asked to sign in again before making the change.</p> },
      { question: "I’ve lost access to my email or Google account.", answer: <p><Link href="/support?topic=recovery">Contact support</Link> so Neffi can verify your account. Don’t sign in with a new email to try to move your card. If support has already sent a recovery code, use <Link href="/support/recover">Complete recovery</Link> before signing in with the new address.</p> },
    ],
  },
  {
    id: "troubleshooting", title: "Something isn’t working", description: "A few checks before you contact us.",
    questions: [
      { question: "The phone doesn’t react to the card.", answer: <p>Check whether the phone supports NFC and whether NFC is enabled where the device offers that setting. Try its NFC reading area again. You can use the Sharing QR as an alternative. If the card still isn’t working, <Link href="/support?topic=defective">contact support</Link>.</p> },
      { question: "My profile says it isn’t available.", answer: <p>Sign in to your own account and check that the card is connected to a published profile and turned on. Visitors see a general unavailable message, so it won’t explain the private account reason. If your settings look right, <Link href="/support">ask support</Link>.</p> },
      { question: "My card is missing from my account.", answer: <p>Check that you signed in to the account used when claiming the card. Different email addresses can belong to separate accounts. If you still can’t find it, <Link href="/support?topic=ownership">contact support</Link> rather than creating another account.</p> },
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="mp-page help-page">
      <MarketingPageHeader />
      <section className="mp-section help-hero" aria-labelledby="help-title">
        <div className="mp-container">
          <h1 id="help-title" className="mp-title">A clear next step.</h1>
          <p className="mp-lead">Find an answer, finish setting up, or get help with your card. Choose what you need a hand with.</p>
          <nav aria-label="Help topics" className="help-index">
            {topics.map(({ id, title, description }) => (
              <a key={id} href={`#${id}`}><span><strong>{title}</strong><span>{description}</span></span><span aria-hidden>↓</span></a>
            ))}
          </nav>
        </div>
      </section>
      <SectionDivider />

      <div className="mp-section">
        <div className="mp-container help-answers">
          <aside className="help-rail" aria-label="Useful links">
            <p>Just getting started?</p>
            <Link href="/guide" className="mp-text-link">Follow the setup guide <span aria-hidden>→</span></Link>
            <Link href="/activate" className="mp-text-link">Activate your card <span aria-hidden>→</span></Link>
          </aside>
          <div>
            {topics.map(({ id, title, questions }) => (
              <section id={id} key={id} aria-labelledby={`${id}-heading`} className="help-topic">
                <h2 id={`${id}-heading`} className="mp-heading">{title}</h2>
                <MarketingQuestions items={questions} />
                <a href="#help-title" className="help-topic-return">Back to topics <span aria-hidden>↑</span></a>
              </section>
            ))}
          </div>
        </div>
      </div>
      <SectionDivider />
      <MarketingNextStep title="Still need a hand?" href="/support" label="Contact support"><p>Tell Neffi what happened. For a lost email or Google account, choose account recovery. Already have a recovery code? <Link href="/support/recover" className="mp-text-link">Complete recovery.</Link></p></MarketingNextStep>
    </main>
  );
}
