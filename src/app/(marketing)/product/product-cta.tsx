import Link from "next/link";
import { NeffiMark } from "./neffi-mark";

export function ProductCta() {
  return (
    <section aria-labelledby="product-cta-heading" className="pp-section pp-section-minor pp-section-tight">
      <div className="pp-container pp-cta-inner">
        <div className="pp-cta-copy">
          <p className="pp-eyebrow">Your Neffi</p>
          <h2 id="product-cta-heading" className="pp-heading">Ready to make Neffi yours?</h2>
          <p className="pp-support">One card. Your profile. Ready when you need it.</p>
          {/* Same destination as the dock's GET_NEFFI_HREF. */}
          <Link href="/pricing" className="pp-button pp-button-primary">Get Neffi</Link>
        </div>
        <NeffiMark className="pp-cta-mark" />
      </div>
    </section>
  );
}
