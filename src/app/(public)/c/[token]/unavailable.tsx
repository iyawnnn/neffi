import Link from "next/link";
import { NeffiLogo } from "@/components/neffi-logo";

// The same words for every reason a card shows nothing, so the page never reveals whether a link exists or why it is off.
export function Unavailable({ manageHref }: { manageHref?: string }) {
  return (
    <main className="flex min-h-[70dvh] flex-1 flex-col items-center justify-center bg-canvas px-5 py-16 text-center text-foreground">
      <NeffiLogo aria-label="Neffi" className="mb-10 h-auto w-24" />
      <h1 className="max-w-md text-2xl font-semibold tracking-tight sm:text-[1.75rem]">This Neffi isn’t available right now</h1>
      <p className="mt-3 max-w-sm text-body text-fg-secondary">There’s nothing to share from this card right now.</p>
      {manageHref ? (
        <Link href={manageHref} className="mt-8 inline-flex min-h-11 items-center rounded-lg bg-action px-4 text-body font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Manage this card</Link>
      ) : null}
    </main>
  );
}
