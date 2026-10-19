import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// Shared frame for adding and editing one scene item: back link, title, then the form in a single panel.
export function BlockPage({ backHref, icon, title, description, children }: { backHref: string; icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <main data-canvas className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-6 pb-10 md:px-6 md:pt-8">
      <Link href={backHref} className="-ml-2 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-md px-2 text-meta font-medium text-fg-secondary transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand">
        <ArrowLeft aria-hidden className="size-3.5" />Back to mode
      </Link>
      <section aria-labelledby="block-title" className="rounded-panel border bg-background p-5 md:p-6">
        <div className="mb-6 flex items-center gap-3.5">
          {icon}
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 id="block-title" className="break-words text-section font-semibold text-foreground">{title}</h1>
            <p className="text-meta text-fg-secondary">{description}</p>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}
