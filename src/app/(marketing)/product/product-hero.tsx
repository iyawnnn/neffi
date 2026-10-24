import { NeffiLogo } from "@/components/neffi-logo";
import Link from "next/link";
import { ProductIdentityStack } from "./product-identity-stack";
import { HERO_PRIMARY_CLASS, HERO_SECONDARY_CLASS, PRIMARY_CTA_REFLECTIONS } from "../hero-cta-styles";

export function ProductHero() {
  return (
    <section aria-labelledby="product-heading" className="pp-hero">
      <Link href="/" aria-label="Neffi home" className="pp-wordmark">
        <span>
          <NeffiLogo aria-hidden />
        </span>
      </Link>

      <p className="pp-eyebrow pp-hero-eyebrow">The Neffi card</p>
      <h1 id="product-heading" className="pp-hero-heading">Meet Neffi.</h1>
      <p className="pp-hero-support">One physical card, connected to a profile you can update whenever you need to.</p>
      <div className="pp-hero-actions">
        {/* Same destination as the dock's GET_NEFFI_HREF. */}
        <Link href="/pricing" className={`${HERO_PRIMARY_CLASS} px-6`}>
          {PRIMARY_CTA_REFLECTIONS}
          <span className="relative">Get Neffi</span>
        </Link>
        <Link href="/guide" className={`${HERO_SECONDARY_CLASS} px-6`}>See how it works</Link>
      </div>

      <ProductIdentityStack />
    </section>
  );
}
