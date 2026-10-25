import { ArrowRight } from "lucide-react";
import { HERO_PRIMARY_CLASS, PRIMARY_CTA_REFLECTIONS } from "./hero-cta-styles";

export const FACEBOOK_ORDER_URL = "https://www.facebook.com/p/Neffi-61595507571192/";

export function OrderLink() {
  return (
    <a href={FACEBOOK_ORDER_URL} target="_blank" rel="noopener noreferrer" className={`${HERO_PRIMARY_CLASS} group gap-2 px-4`}>
      {PRIMARY_CTA_REFLECTIONS}
      <span className="relative">Order on Facebook</span>
      <ArrowRight size={18} aria-hidden="true" className="relative shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:-rotate-45 motion-safe:group-focus-visible:-rotate-45 motion-reduce:transition-none" />
    </a>
  );
}
