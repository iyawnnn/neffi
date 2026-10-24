import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NeffiLogo } from "@/components/neffi-logo";
import { HERO_PRIMARY_CLASS, PRIMARY_CTA_REFLECTIONS } from "./(marketing)/hero-cta-styles";
import "./not-found.css";

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found-content">
        <NeffiLogo width={469} height={180} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Neffi" className="not-found-logo" />
        <Image src="/neffi-not-found.svg" width={360} height={240} alt="" aria-hidden="true" className="not-found-illustration" />
        <p className="not-found-label">ERROR 404</p>
        <h1>This page missed the tap.</h1>
        <p className="not-found-description">The page you’re looking for couldn’t be found.</p>
        <Link href="/" className={`${HERO_PRIMARY_CLASS} not-found-home group gap-2`}>
          {PRIMARY_CTA_REFLECTIONS}
          <span className="relative">Go back home</span>
          <ArrowRight size={18} aria-hidden="true" className="relative shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:-rotate-45 motion-safe:group-focus-visible:-rotate-45 motion-reduce:transition-none" />
        </Link>
      </div>
    </main>
  );
}
