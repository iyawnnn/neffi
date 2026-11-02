import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import { MarketingPageHeader } from "../marketing-page";
import { FinalCtaSection } from "../final-cta-section";
import { HelpBrowser } from "./help-browser";
import "./help.css";

export const metadata: Metadata = pageMetadata({
  title: "Help",
  description: "Answers about ordering, payment, J&T delivery, activating your card, sharing with NFC or QR, and account issues.",
  path: "/help",
});

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
