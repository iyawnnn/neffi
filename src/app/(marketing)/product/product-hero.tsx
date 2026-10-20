import Image from "next/image";
import Link from "next/link";
import { ProductIdentityStack } from "./product-identity-stack";

export function ProductHero() {
  return (
    <section aria-labelledby="product-heading" className="pp-hero">
      <Link href="/" aria-label="Neffi home" className="pp-wordmark">
        <span>
          <Image src="/neffi-wordmark-ink.svg" alt="" width={1200} height={500} priority unoptimized />
        </span>
      </Link>

      <p className="pp-eyebrow pp-hero-eyebrow">The Neffi card</p>
      <h1 id="product-heading" className="pp-hero-heading">Meet Neffi.</h1>
      <p className="pp-hero-support">One physical card, connected to a profile you can update whenever you need to.</p>
      <div className="pp-hero-actions">
        {/* Same destination as the dock's GET_NEFFI_HREF. */}
        <Link href="/pricing" className="pp-button pp-button-primary">Get Neffi</Link>
        <Link href="/guide" className="pp-button pp-button-secondary">See how it works</Link>
      </div>

      <ProductIdentityStack />
    </section>
  );
}
