import type { Metadata } from "next";
import Link from "next/link";
import { LegalCallout, LegalPage, MailLink, type LegalSection } from "../legal-page";
import { FACEBOOK_ORDER_URL } from "../order-link";

// Drafted from docs/legal/privacy-terms-operations-audit.md. Kept out of search until the owners approve publication.
export const metadata: Metadata = {
  title: "Neffi — Terms & Conditions",
  description: "The simple rules for using Neffi, creating a profile, and ordering a Neffi card.",
  robots: { index: false, follow: true },
};

const facebookPage = <a href={FACEBOOK_ORDER_URL} target="_blank" rel="noopener noreferrer">official Facebook page</a>;
const support = <MailLink address="support@getneffi.com" />;

const sections: LegalSection[] = [
  {
    id: "using-neffi", title: "Using Neffi", body: <>
      <p>These Terms are the agreement between you and Neffi (“Neffi”, “we”, “us”, or “our”). By creating an account, using Neffi or buying a Neffi card, you agree to them.</p>
      <p>If you are under 18, you may use Neffi with the permission and involvement of a parent or legal guardian. A parent or guardian must approve purchases made by a minor.</p>
    </>,
  },
  {
    id: "account-and-profile", title: "Your account and profile", body: <>
      <p>You sign in with a code sent to your email or with Google. Keep your email account secure, because anyone who controls it may be able to sign in to Neffi.</p>
      <p>Your profile is yours to control. You choose what becomes public, you are responsible for what you publish, and you can edit, hide or unpublish it at any time.</p>
    </>,
  },
  {
    id: "your-card", title: "Your Neffi card", body: <>
      <p>Each Neffi card holds one permanent Neffi link, so you can keep changing your profile without changing the card. Cards come in the standard Neffi design; custom or personalized physical designs are not offered.</p>
      <p>To activate, scan the Package QR, enter the private activation code inside the packaging and sign in. This adds the card to your account. Keep the code private until then.</p>
      <LegalCallout title="Package QR ≠ Sharing QR">
        <dl className="legal-pair">
          <div><dt>Package QR</dt><dd>Used to activate your Neffi.</dd></div>
          <div><dt>Sharing QR</dt><dd>Printed on the back of the card and opens your public profile.</dd></div>
        </dl>
      </LegalCallout>
      <p>People can open your profile by tapping the card on a phone with NFC turned on, or by scanning the Sharing QR. NFC support varies by phone, so the Sharing QR is there when tapping does not work.</p>
    </>,
  },
  {
    id: "ordering-and-payment", title: "Ordering and payment", body: <>
      <p>Neffi is ordered through our {facebookPage}. Message us, we confirm your order and delivery details, and then send payment details.</p>
      <p>A Neffi Digital Business Card is <strong>₱799</strong>. <strong>Shipping is charged separately.</strong> We accept GCash, Maya, MariBank, GoTyme and bank transfer. Cash on delivery (COD) is not currently available.</p>
      <p>Messaging Neffi does not by itself complete a purchase. Your order is accepted once Neffi confirms your payment.</p>
    </>,
  },
  {
    id: "shipping-and-issues", title: "Shipping, cancellations and product issues", body: <>
      <p><strong>Shipping.</strong> We ship with J&amp;T. The shipping fee depends on your location and is confirmed before you pay. Delivery time depends on the courier and your destination, and we send your tracking number when it is available.</p>
      <p><strong>Cancellations.</strong> You can cancel your order as long as it has not been shipped. If an approved cancellation requires a refund, Neffi will coordinate the refund with you using an appropriate payment method.</p>
      <p><strong>Damaged or defective cards.</strong> If your Neffi arrives damaged or does not work, contact {support} and send reasonable evidence if we ask, such as photos or a short video. We review the problem and provide an appropriate remedy where the card arrived damaged or defective. Damage from misuse after delivery is treated differently. Your consumer rights always apply.</p>
    </>,
  },
  {
    id: "lost-cards", title: "Lost cards", body: <>
      <p>A lost card is not a damaged or defective product. Your profile stays in your Neffi account, but someone who finds the card may still open your public profile while the card is on. You can turn the card off in your account.</p>
      <p>Contact {support} for help or a replacement. Replacement costs may apply and will be confirmed before a replacement is arranged.</p>
    </>,
  },
  {
    id: "use-and-content", title: "Acceptable use and your content", body: <>
      <p>Please do not use Neffi to impersonate others, publish unlawful content, spread malware or phishing, violate someone’s privacy or intellectual property, attack or abuse the service, use cards or accounts you are not authorized to use, or get around security.</p>
      <p>You keep ownership of everything you add, including photos, logos, projects and links. You give Neffi only the permissions needed to host, store, process, transmit and display that content to operate the service.</p>
    </>,
  },
  {
    id: "service-and-ip", title: "Neffi’s service and intellectual property", body: <>
      <p>The Neffi name, logo, card design and software belong to Neffi or the relevant rights holders.</p>
      <p>We keep improving Neffi and features may change. We cannot promise the service will always be available, and phones, couriers and other third-party services can behave differently. If an account, profile or card is used in a way that breaks these Terms or the law, or creates a security risk, we may restrict it and will explain why where appropriate.</p>
    </>,
  },
  {
    id: "responsibility", title: "Responsibility and consumer rights", body: <>
      <p>Neffi does not guarantee uninterrupted service or compatibility with every device. To the extent the law allows, we are not responsible for circumstances outside our reasonable control.</p>
      <p>Nothing in these Terms removes rights you have under Philippine consumer law or other rights that cannot legally be excluded.</p>
    </>,
  },
  {
    id: "privacy", title: "Privacy", body: <>
      <p>Neffi’s <Link href="/privacy">Privacy Policy</Link> explains how we handle personal information when you use Neffi.</p>
    </>,
  },
  {
    id: "changes", title: "Changes to these Terms", body: <>
      <p>When we make material changes to these Terms, we will update the effective date and provide additional notice where appropriate.</p>
    </>,
  },
  {
    id: "law-and-contact", title: "Philippine law and contact", body: <>
      <p>These Terms are governed by the applicable laws of the Philippines.</p>
      <p>For help with your account, card or order, email {support}. For general questions, email <MailLink address="hello@getneffi.com" />. For privacy requests, email <MailLink address="privacy@getneffi.com" />. To order, message our {facebookPage}.</p>
    </>,
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms & Conditions" introduction="The simple rules for using Neffi, creating a profile, and ordering a Neffi card." updated={{ label: "October 25, 2026", iso: "2026-10-25" }} sections={sections} />;
}
