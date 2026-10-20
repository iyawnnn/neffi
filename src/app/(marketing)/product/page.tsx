import type { Metadata } from "next";
import { SectionDivider } from "../section-divider";
import { ProductAnatomy } from "./product-anatomy";
import { ProductCapabilities } from "./product-capabilities";
import { ProductComparison } from "./product-comparison";
import { ProductCta } from "./product-cta";
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

// One shared divider at each major transition. Facts and the closing CTA read as one block, and the footer brings its own divider.
// The physical card appears once, in "What's in your hand".
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
      <ProductCta />
    </main>
  );
}
