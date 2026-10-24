import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingNav } from "@/app/(marketing)/marketing-nav";
import { MarketingFooter } from "@/app/(marketing)/marketing-footer";
import { MarketingPageHeader } from "@/app/(marketing)/marketing-page";

export function PublicSiteShell({ children, footer = <MarketingFooter /> }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <div data-marketing-content="" className="flex flex-1 flex-col bg-canvas">
        {children}
        {footer}
      </div>
      <MarketingNav />
    </>
  );
}

export function PublicUtilityLayout({ children }: { children: ReactNode }) {
  return <PublicSiteShell><MarketingPageHeader />{children}</PublicSiteShell>;
}

export function FocusedUtilityLayout({ children, recovery = false }: { children: ReactNode; recovery?: boolean }) {
  return (
    <PublicSiteShell footer={<FocusedUtilityFooter recovery={recovery} />}>
      <MarketingPageHeader />
      {children}
    </PublicSiteShell>
  );
}

function FocusedUtilityFooter({ recovery }: { recovery: boolean }) {
  const links = [
    { href: "/support", label: recovery ? "Back to support" : "Need help?" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ];
  return (
    <footer aria-label="Utility links" className="mt-auto px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+11rem)] min-[769px]:pb-32">
      <ul className="mx-auto flex w-fit flex-wrap items-center justify-center gap-x-4 gap-y-1 text-meta text-fg-secondary">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className="inline-flex min-h-11 items-center rounded-md hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{label}</Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}
