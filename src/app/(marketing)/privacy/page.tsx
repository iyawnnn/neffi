import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "../legal-page";

export const metadata: Metadata = {
  title: "Neffi — Privacy Policy",
  description: "Privacy Policy publication status and the outline awaiting approved Neffi policy content.",
  robots: { index: false, follow: true },
};

const sections: LegalSection[] = [
  { id: "overview", title: "Overview", requiredCopy: "Add the approved policy scope, responsible entity, and applicable services. Confirm the policy’s effective date before publication." },
  { id: "information", title: "Information we collect", requiredCopy: "Approve the description of information handled across accounts, public profiles, support, and enquiries. Technical implementation notes are not a substitute for policy wording." },
  { id: "use", title: "How information is used", requiredCopy: "Add approved purposes and the applicable grounds for processing. Do not infer legal bases from the existence of a product feature." },
  { id: "sharing", title: "Sharing and service providers", requiredCopy: "Confirm the approved disclosures about service providers, recipients, and any international processing arrangements." },
  { id: "retention", title: "Retention and security", requiredCopy: "Approve retention periods or criteria, deletion practices, and the security description. No retention schedule or security guarantee is published here." },
  { id: "choices", title: "Your choices and rights", requiredCopy: "Confirm which rights apply, how requests are made, and how Neffi responds. Add the approved process without promising unsupported account or data operations." },
  { id: "contact", title: "Privacy contact", requiredCopy: "Provide an approved privacy contact and any required business details. No privacy email or legal entity has been invented for this template." },
  { id: "changes", title: "Changes to this policy", requiredCopy: "Add the approved approach to policy changes, notice, and version dates." },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" introduction="A clear place for Neffi’s privacy information. The policy is awaiting approved content before publication." sections={sections} />;
}
