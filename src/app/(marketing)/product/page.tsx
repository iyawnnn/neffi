import type { Metadata } from "next";
import { FinalCtaSection } from "../final-cta-section";
import { SectionDivider } from "../section-divider";
import { ProductAnatomy } from "./product-anatomy";
import { ProductCapabilities } from "./product-capabilities";
import { ProductComparison } from "./product-comparison";
import { ProductFacts } from "./product-facts";
import { ProductHero } from "./product-hero";
import { ProductMakeItYours } from "./product-profile-builder";
import { ProductProfileEvolution } from "./product-profile-evolution";
import "../profile-experience.css";
import "./product.css";

export const metadata: Metadata = {
  title: "Neffi — The card",
  description: "One physical NFC card connected to a digital profile you can update whenever you need to.",
};

// One shared divider at each major transition. As on Home, the shared closing CTA follows the last section without a divider, and
// the footer brings its own. The physical card is shown in "What's in your hand" and in that shared CTA only.
export default function ProductPage() {
  return (
    <main className="pp-page">
      <ProductHero />
      <SectionDivider />
      <ProductProfileEvolution />
      <SectionDivider />
      <ProductAnatomy />
      <SectionDivider />
      <ProductMakeItYours />
      <SectionDivider />
      <ProductCapabilities />
      <SectionDivider />
      <ProductComparison />
      <SectionDivider />
      <ProductFacts />
      <FinalCtaSection />
    </main>
  );
}
