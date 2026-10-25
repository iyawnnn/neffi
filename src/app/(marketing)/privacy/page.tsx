import type { Metadata } from "next";
import { LegalCallout, LegalPage, MailLink, type LegalSection } from "../legal-page";

// Drafted from docs/legal/privacy-terms-operations-audit.md, which keeps the detailed provider inventory.
// Kept out of search until the owners approve publication.
export const metadata: Metadata = {
  title: "Neffi — Privacy Policy",
  description: "How Neffi handles the information you share with us and the choices you have.",
  robots: { index: false, follow: true },
};

const privacy = <MailLink address="privacy@getneffi.com" />;

const sections: LegalSection[] = [
  {
    id: "information-we-collect", title: "Information we collect", body: <>
      <p>This policy covers Neffi (“Neffi”, “we”, “us”, or “our”), including the Neffi website, accounts, cards and support. We collect only what Neffi needs to work.</p>
      <ul>
        <li><strong>Account information</strong>: your sign-in email and, if you sign in with Google, your name and profile picture from Google.</li>
        <li><strong>Profile information</strong>: what you choose to add to your Neffi profile.</li>
        <li><strong>Card information</strong>: which card belongs to your account and which profile it opens.</li>
        <li><strong>Orders and support</strong>: the details needed for your order, delivery, payment records, support requests and account recovery.</li>
        <li><strong>Messages sent through a profile</strong>: what a visitor enters in a profile’s contact form, which we deliver to the profile owner.</li>
        <li><strong>Technical information</strong>: limited information, such as IP address and device type, needed to keep you signed in, prevent abuse and fix problems.</li>
      </ul>
    </>,
  },
  {
    id: "public-profile", title: "Your public Neffi profile", body: <>
      <LegalCallout title="Published means public">
        <p>When you publish a Neffi profile, the information you add to it can be seen by anyone who opens it by tapping your card (NFC), scanning its Sharing QR, or visiting its permanent profile link.</p>
      </LegalCallout>
      <p>Depending on what you add, this can include your name, headline, company and bio, your photo or logo and cover image, your location, a public phone number, contact email and website, your links, and the sections and work you add.</p>
      <p><strong>Your sign-in email is separate from the contact email you choose to show publicly.</strong> Your sign-in email, security settings and order or support history are never shown on your profile.</p>
      <p>Only add what you are comfortable sharing. Visitors can save what they see. You can edit, hide or unpublish your profile, or turn a card off, at any time in your Neffi account.</p>
    </>,
  },
  {
    id: "how-we-use", title: "How we use your information", body: <>
      <p>We use your information to:</p>
      <ul>
        <li>create and maintain your account, and let you sign in with an email code or with Google;</li>
        <li>activate, connect and manage your cards, and show your published profile;</li>
        <li>process and deliver your order and respond to support requests;</li>
        <li>send service messages such as sign-in codes, security notices and support replies;</li>
        <li>keep Neffi secure and reliable; and</li>
        <li>meet our legal and accounting obligations.</li>
      </ul>
      <p>We do not send marketing emails or build advertising profiles. <strong>Neffi does not sell personal information to advertisers or data brokers.</strong></p>
    </>,
  },
  {
    id: "sharing", title: "Who we share information with", body: <>
      <p>We work with trusted service providers that help us operate Neffi, including services for hosting, data and image storage, email delivery, sign-in, and technical monitoring. We share information with these providers only as needed for them to provide services to Neffi.</p>
      <p>When you place an order, information may also be shared with services involved in completing it, such as our delivery courier and the payment method you choose. Orders are arranged through our Facebook page, so that conversation is also handled by Meta under its own policy.</p>
      <p>Some service providers may process information outside the Philippines. We take reasonable steps to work with providers that offer appropriate privacy and security protections.</p>
      <p>We may also disclose information when the law requires it, or to protect people or Neffi from harm or fraud.</p>
    </>,
  },
  {
    id: "cookies-and-security", title: "Cookies and security", body: <>
      <p>Neffi uses only essential cookies: to keep you signed in, to complete Google sign-in, and briefly while you activate a card. We do not use advertising or tracking pixels, and we do not track who views or taps a profile.</p>
      <p>We use reasonable technical and organizational safeguards designed to protect information. No online service can guarantee absolute security, so please keep your email account secure and your activation code private.</p>
    </>,
  },
  {
    id: "retention", title: "How long we keep information", body: <>
      <p>We keep personal information only for as long as reasonably necessary to provide Neffi, maintain security, support transactions and customers, resolve disputes, enforce agreements, and meet legal or accounting obligations.</p>
      <p>Sign-in and recovery codes expire shortly after they are sent. Profile content stays until you change or delete it, and messages sent through a profile stay until the profile owner deletes them.</p>
    </>,
  },
  {
    id: "your-rights", title: "Your privacy rights and choices", body: <>
      <p>Under the Philippine Data Privacy Act of 2012, and subject to its conditions, you have the right to be informed about how your information is used, to access and correct it, to object to its processing, to ask for it to be erased or blocked, and to receive a copy where applicable. You may also claim damages where the law allows and file a complaint with the National Privacy Commission.</p>
      <p>Many choices are available in your Neffi account: you can edit or delete your profile, change your sign-in email, remove Google sign-in, sign out of all devices and delete messages.</p>
      <p>For anything else, including access, correction, deletion or objection requests, email {privacy}. You may request deletion of your Neffi account or personal information this way. Some information may need to be retained where necessary to comply with legal obligations, resolve disputes, maintain security, or establish or defend legal claims. We may ask you to confirm your identity first.</p>
    </>,
  },
  {
    id: "young-users", title: "Young users", body: <>
      <p>Neffi may be used by younger users with the permission and involvement of a parent or legal guardian. If you are under 18 and need help with your information or privacy rights, your parent or guardian may contact us on your behalf.</p>
    </>,
  },
  {
    id: "changes", title: "Changes to this policy", body: <>
      <p>When we make material changes to this policy, we will update the date above and provide additional notice where appropriate.</p>
    </>,
  },
  {
    id: "contact", title: "Contact us", body: <>
      <p>For privacy questions and requests, email {privacy}. For help with your account, card or order, email <MailLink address="support@getneffi.com" />.</p>
    </>,
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" introduction="How Neffi handles the information you share with us and the choices you have." updated={{ label: "October 25, 2026", iso: "2026-10-25" }} sections={sections} />;
}
