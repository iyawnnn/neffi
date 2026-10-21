import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "../legal-page";

export const metadata: Metadata = {
  title: "Neffi — Terms & Conditions",
  description: "Terms & Conditions publication status and the outline awaiting approved Neffi terms.",
  robots: { index: false, follow: true },
};

const sections: LegalSection[] = [
  { id: "scope", title: "About these terms", requiredCopy: "Add the approved contracting entity, service scope, eligibility, and acceptance wording. Confirm an effective date before publication." },
  { id: "accounts", title: "Accounts and access", requiredCopy: "Approve the customer responsibilities, account requirements, and access provisions. Product behavior alone does not establish contractual obligations." },
  { id: "purchases", title: "Purchases and fulfilment", requiredCopy: "Add approved ordering, payment, delivery, cancellation, refund, and replacement terms. No prices, warranties, delivery promises, or refund rights are created by this outline." },
  { id: "profiles", title: "Profiles and shared content", requiredCopy: "Approve content responsibilities, permissions, and any licence wording for customer profiles and uploaded material." },
  { id: "use", title: "Use of Neffi", requiredCopy: "Add the approved acceptable-use rules and any provisions for suspension or ending access." },
  { id: "availability", title: "Availability and responsibility", requiredCopy: "Provide reviewed service availability, limitation, and responsibility clauses. Do not infer a lifetime service commitment from the card’s permanent-link design." },
  { id: "law", title: "Applicable law and disputes", requiredCopy: "Add only reviewed wording about applicable law, jurisdiction, and dispute handling. None is established by this template." },
  { id: "contact", title: "Contact and changes", requiredCopy: "Confirm the legal contact, required business details, and the approved process for updating these terms." },
];

export default function TermsPage() {
  return <LegalPage title="Terms & Conditions" introduction="A readable home for Neffi’s terms. Approved contractual wording is required before these terms can be published." sections={sections} />;
}
