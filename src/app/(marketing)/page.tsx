import { NeffiLogo } from "@/components/neffi-logo";
import Link from "next/link";
import { HeroCard } from "./hero-card";
import { IdentitySection } from "./identity-section";
import { SectionDivider } from "./section-divider";
import { ProfileExperienceSection } from "./profile-experience-section";
import { UseCasesSection } from "./use-cases-section";
import { SetupJourneySection } from "./setup-journey-section";
import { FinalCtaSection } from "./final-cta-section";

// The hero is one composed opening screen on a continuous Snow canvas. It spans the whole small viewport (svh, so mobile browser
// chrome never makes it jump) and keeps the dock's clearance inside itself as bottom padding, so its content stops above the dock
// while the tap field fades out across the full screen and on into Section 2 (it is clipped only sideways). A floor lets a very short
// screen scroll a little instead of crushing the card, and a ceiling (about 1100px) stops the stage growing without limit on a huge
// viewport or an extreme zoom-out. Type and gaps are clamped against the viewport height so common laptops fit without shrinking
// everything; the card stage takes what is left (see hero-card.tsx).
export default function Home() {
  return (
    <main>
      <section className="relative isolate flex h-[clamp(calc(43.5rem+env(safe-area-inset-bottom)),100svh,70rem)] flex-col items-center overflow-x-clip bg-canvas px-6 pt-[clamp(1rem,3svh,2rem)] pb-[calc(7.5rem+env(safe-area-inset-bottom))] min-[769px]:h-[clamp(41rem,100svh,68.75rem)] min-[769px]:pb-28">
        <Link
          href="/"
          aria-label="Neffi home"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <span className="block aspect-[533/222] h-6">
            <NeffiLogo aria-hidden className="block h-full w-full text-foreground" />
          </span>
        </Link>

        {/* Raised above the card stage: the stage is its own stacking context (perspective), so without this its field would paint
          over the CTAs. */}
        <div className="relative z-10 mt-[clamp(1rem,3.2svh,2.5rem)] flex flex-col items-center text-center">
          <p className="text-sm font-medium text-fg-secondary">
            Your profile, ready to tap.
          </p>
          <h1 className="mt-[clamp(0.5rem,1.6svh,1rem)] max-w-[15ch] text-[clamp(2rem,min(8.4vw,6.8svh),4.5rem)] leading-[1.04] font-semibold tracking-[-0.035em] text-balance text-foreground min-[769px]:max-w-[18ch]">
            Share who you are with a tap.
          </h1>
          <p className="mt-[clamp(0.5rem,2svh,1.5rem)] max-w-[34rem] text-[clamp(0.9375rem,2.3svh,1.125rem)] leading-[1.55] text-pretty text-fg-secondary">
            Neffi is an NFC digital business card that lets you share your
            contact details, links, and profile instantly — no app required.
          </p>
          <div className="mt-[clamp(1rem,3svh,2rem)] flex w-full max-w-[22rem] gap-3 min-[769px]:max-w-none min-[769px]:justify-center">
            {/* Both buttons get a quiet internal polish (inset highlight and shade) in the dock CTA's material language, but static, with no
              outer glow and no moving light. The primary adds a fixed top-right reflection. */}
            <Link
              href="/product"
              className="relative inline-flex h-12 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-action text-base font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-12px_16px_-12px_rgb(0_0_0/0.35),0_1px_2px_rgb(17_17_19/0.14)] interact transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-[769px]:h-14 min-[769px]:w-48 min-[769px]:flex-none"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_58%,rgb(255_255_255/0.1)_66%,transparent_74%)]"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -top-8 -right-6 size-20 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.3),transparent)]"
              />
              <span className="relative">Explore Neffi</span>
            </Link>
            <Link
              href="/guide"
              className="inline-flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-border-strong bg-canvas bg-[linear-gradient(180deg,rgb(255_255_255/0.75),transparent_55%)] text-base font-medium text-foreground shadow-[inset_0_1px_0_rgb(255_255_255),inset_0_-8px_12px_-10px_rgb(17_17_19/0.08)] interact transition-colors hover:border-foreground/30 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-[769px]:h-14 min-[769px]:w-48 min-[769px]:flex-none"
            >
              View Guide
            </Link>
          </div>
        </div>

        <HeroCard />
      </section>
      <SectionDivider />
      <IdentitySection />
      <SectionDivider />
      <ProfileExperienceSection />
      <SectionDivider />
      <UseCasesSection />
      <SectionDivider />
      <SetupJourneySection />
      <FinalCtaSection />
    </main>
  );
}
