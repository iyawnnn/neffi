import { MarketingNav } from "./marketing-nav";
import { MarketingFooter } from "./marketing-footer";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
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
