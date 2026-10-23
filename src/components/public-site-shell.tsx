import type { ReactNode } from "react";
import { MarketingNav } from "@/app/(marketing)/marketing-nav";
import { MarketingFooter } from "@/app/(marketing)/marketing-footer";
import { MarketingPageHeader } from "@/app/(marketing)/marketing-page";

export function PublicSiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div data-marketing-content="" className="flex flex-1 flex-col bg-canvas">
        {children}
        <MarketingFooter />
      </div>
      <MarketingNav />
    </>
  );
}

export function PublicUtilityLayout({ children }: { children: ReactNode }) {
  return <PublicSiteShell><MarketingPageHeader />{children}</PublicSiteShell>;
}
