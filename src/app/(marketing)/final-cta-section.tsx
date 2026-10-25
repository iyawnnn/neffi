import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import "./final-cta.css";

export function FinalCtaSection({ title, description, href = "/pricing", label = "Get Neffi", external = false, variant }: {
  title?: string;
  description?: string;
  href?: string;
  label?: string;
  external?: boolean;
  variant?: "support";
} = {}) {
  return (
    <section aria-labelledby="final-cta-heading" className="final-cta-section" data-variant={variant}>
      <div className="final-cta-container">
        <div className="final-cta-panel">
          <div className="final-cta-copy">
            <h2 id="final-cta-heading" className="final-cta-heading">
              {title ?? <><span>Turn one tap into</span>{" "}<span>a connection.</span></>}
            </h2>
            <p className="final-cta-support">
              {description ?? "Share your profile, work, and ways to reach you with one Neffi card."}
            </p>
            <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="final-cta-action">
              <span>{label}</span>
              {variant === "support" ? <ArrowRight aria-hidden="true" size={18} strokeWidth={2.25} /> : <ArrowUpRight aria-hidden="true" size={18} strokeWidth={2.25} />}
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
