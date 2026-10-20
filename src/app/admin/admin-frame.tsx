import Link from "next/link";
import type { ReactNode } from "react";
import { NeffiLogo } from "@/components/neffi-logo";
import { AdminNav } from "./admin-nav";
import { CommandMenuField, CommandMenuIconButton } from "./command-palette";
import { MobileMenu } from "./mobile-menu";

/** The owner frame: sidebar on desktop, a compact app bar with a menu drawer on phones. Presentation only; the layout authorizes. */
export function AdminFrame({ account, children, palette, basePath = "/admin" }: { account: ReactNode; children: ReactNode; palette: ReactNode; basePath?: string }) {
  return (
    <div className="app-type flex min-h-dvh flex-col bg-canvas text-foreground lg:flex-row [&_input[type=checkbox]]:size-4 [&_input[type=checkbox]]:accent-action">
      <aside className="flex flex-col border-b bg-background max-lg:sticky max-lg:top-0 max-lg:z-30 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-3 lg:pt-5 lg:pb-4">
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:min-h-8 lg:px-2.5">
          <Link href={basePath} aria-label="Neffi admin home" className="inline-flex min-h-11 items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-brand lg:min-h-8">
            <NeffiLogo aria-hidden className="h-5 w-auto text-foreground" />
            <span aria-hidden className="h-4 w-px bg-border-strong" />
            <span className="text-label font-medium tracking-wide text-fg-secondary uppercase">Admin</span>
          </Link>
          <div className="-mr-2 flex items-center lg:hidden">
            <CommandMenuIconButton />
            <MobileMenu account={account} basePath={basePath} />
          </div>
        </div>
        <div className="hidden lg:mt-5 lg:block"><CommandMenuField /></div>
        <div className="hidden lg:mt-6 lg:block"><AdminNav basePath={basePath} /></div>
        <div className="mt-auto hidden pt-6 lg:block">{account}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {palette}
    </div>
  );
}
