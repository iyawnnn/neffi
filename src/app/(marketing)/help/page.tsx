import type { Metadata } from "next";
import { MarketingPageHeader } from "../marketing-page";
import { FinalCtaSection } from "../final-cta-section";
import { HelpBrowser } from "./help-browser";
import "./help.css";

export const metadata: Metadata = {
  title: "Neffi — Help Center",
  description: "Help with ordering, delivery, activation, sharing, and your Neffi account.",
};

export default function HelpPage() {
  return (
    <main className="mp-page help-page">
      <MarketingPageHeader />
      <HelpBrowser />
      <FinalCtaSection
        variant="support"
        title="Still need a hand?"
        description="Tell us what happened and we’ll help you figure out the next step."
        label="Contact support"
        href="/support"
      />
    </main>
  );
}
