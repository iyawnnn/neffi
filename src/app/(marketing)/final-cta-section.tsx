import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import "./final-cta.css";

export function FinalCtaSection() {
  return (
    <section aria-labelledby="final-cta-heading" className="final-cta-section">
      <div className="final-cta-container">
        <div className="final-cta-panel">
          <div className="final-cta-copy">
            <h2 id="final-cta-heading" className="final-cta-heading">
              <span>Turn one tap into</span>{" "}
              <span>a connection.</span>
            </h2>
            <p className="final-cta-support">
              Share your profile, work, and ways to reach you with one Neffi card.
            </p>
            {/* Same destination as the dock's GET_NEFFI_HREF. */}
            <Link href="/pricing" className="final-cta-action">
              <span>Get Neffi</span>
              <ArrowUpRight aria-hidden="true" size={18} strokeWidth={2.25} />
            </Link>
          </div>
          <Image
            src="/neffi-card-front-preview.svg"
            alt=""
            aria-hidden="true"
            width={324}
            height={205}
            unoptimized
            className="final-cta-card"
          />
        </div>
      </div>
    </section>
  );
}
