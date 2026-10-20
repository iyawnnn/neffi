import { MarketingNav } from "./marketing-nav";

// Clears the fixed dock (desktop) or the full-width bar plus the raised centre action (mobile), including the safe area.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div data-marketing-content="" className="flex flex-1 flex-col bg-canvas pb-[calc(env(safe-area-inset-bottom)+7.5rem)] min-[769px]:pb-28">{children}</div>
      <MarketingNav />
    </>
  );
}
