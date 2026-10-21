import type { ReactNode } from "react";
import { ConvergenceIllustration, LivingSpineIllustration, TapKeyIllustration } from "./identity-illustrations";
import "./identity-illustrations.css";
import { Reveal } from "./reveal";

const figures: { art: ReactNode; title: string; copy: string }[] = [
  { art: <TapKeyIllustration />, title: "Tap to share", copy: "A quick tap opens your Neffi profile instantly — nothing to download." },
  { art: <ConvergenceIllustration />, title: "Everything in one place", copy: "Links, contact details, and your profile stay organized together." },
  { art: <LivingSpineIllustration />, title: "Always up to date", copy: "Update your details anytime, and your card never needs replacing." },
];

export function IdentitySection() {
  return (
    <section aria-labelledby="identity-heading" className="px-6 pt-[clamp(6rem,13vw,11rem)] pb-[clamp(6rem,11vw,10rem)] min-[900px]:pt-16 min-[900px]:pb-28">
      <div className="mx-auto w-full max-w-7xl">
        <h2 id="identity-heading" className="max-w-[75rem] text-[clamp(2rem,3.5vw,3.25rem)] leading-[1.1] font-medium tracking-[-0.025em] text-foreground min-[900px]:text-[clamp(2.75rem,3.4vw,3.125rem)]">
          More than a card.{" "}
          <span className="text-fg-secondary">Neffi brings your contact details, links, and digital profile into one place — ready to share with a tap and update anytime.</span>
        </h2>

        <ul className="-mx-6 mt-10 grid auto-cols-[82vw] grid-flow-col snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-6 [scroll-padding-inline:1.5rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[900px]:mx-0 min-[900px]:mt-12 min-[900px]:auto-cols-auto min-[900px]:grid-flow-row min-[900px]:grid-cols-3 min-[900px]:gap-0 min-[900px]:overflow-visible min-[900px]:px-0">
          {figures.map(({ art, title, copy }) => (
            <li key={title} className="min-w-0 snap-start rounded-xl border border-border bg-subtle p-6 min-[900px]:rounded-none min-[900px]:border-0 min-[900px]:border-l min-[900px]:first:border-l-0 min-[900px]:bg-transparent min-[900px]:px-10 min-[900px]:py-0 min-[900px]:first:pl-0 min-[900px]:last:pr-0">
              <Reveal className="illo-figure flex h-full flex-col" animateOnMount>
                {/* A fixed height (not width), so the three figures and their captions line up even though the middle column is narrower. */}
                <div tabIndex={0} role="img" aria-label={title} className="identity-art flex h-[min(18rem,72vw)] justify-center [&>svg]:h-full [&>svg]:w-auto [&>svg]:max-w-full min-[900px]:h-[clamp(12rem,17vw,16rem)]">{art}</div>
                <figcaption className="mt-6 min-[900px]:mt-8">
                  <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
                  <p className="mt-2 max-w-[24rem] text-base leading-[1.55] text-pretty text-fg-secondary min-[900px]:min-h-[3.1em]">{copy}</p>
                </figcaption>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
