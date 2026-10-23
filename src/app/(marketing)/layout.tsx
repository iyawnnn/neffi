import { PublicSiteShell } from "@/components/public-site-shell";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return <PublicSiteShell>{children}</PublicSiteShell>;
}
