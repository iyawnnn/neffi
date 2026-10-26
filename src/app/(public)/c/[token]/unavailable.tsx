import { NeffiLogo } from "@/components/neffi-logo";
import { ButtonLink } from "@/components/app-ui";

// A card whose link is switched off: the tag stays, the wave to the phone breaks. Decorative only.
function OffCardIllustration() {
  return (
    <svg aria-hidden viewBox="0 0 260 150" fill="none" className="h-auto w-52 text-border-strong sm:w-60">
      <rect x="68" y="30" width="124" height="80" rx="12" className="fill-background" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="88" cy="52" r="5" className="fill-action" />
      <rect x="84" y="80" width="46" height="5" rx="2.5" className="fill-border" />
      <rect x="84" y="91" width="28" height="5" rx="2.5" className="fill-border" />
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M204 56a22 22 0 0 1 0 38" strokeDasharray="0.1 7" />
        <path d="M216 44a38 38 0 0 1 0 62" strokeDasharray="0.1 9" opacity="0.6" />
        <path d="M228 32a54 54 0 0 1 0 86" strokeDasharray="0.1 11" opacity="0.35" />
      </g>
    </svg>
  );
}

// The same words for every reason a card shows nothing, so the page never reveals whether a link exists or why it is off.
export function Unavailable({ manageHref }: { manageHref?: string }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center bg-canvas px-5 pb-16 text-center text-foreground">
      <NeffiLogo aria-label="Neffi" preserveAspectRatio="xMidYMid meet" className="mt-8 h-6 w-auto text-foreground sm:mt-10" />
      <div className="flex w-full flex-1 flex-col items-center justify-center py-12">
        <OffCardIllustration />
        <h1 className="mt-8 max-w-md text-balance text-2xl font-semibold tracking-tight sm:text-[1.75rem]">This Neffi isn’t available right now</h1>
        <p className="mt-3 max-w-sm text-body text-fg-secondary">There’s nothing to share from this card right now.</p>
        {manageHref ? <ButtonLink href={manageHref} variant="action" className="mt-8">Manage this card</ButtonLink> : null}
      </div>
    </main>
  );
}
