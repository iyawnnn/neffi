import type { Metadata } from "next";

// Customer surface (/app/*). Private and never indexed; authentication arrives in Milestone 3.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CustomerLayout({ children }: LayoutProps<"/app">) {
  return <>{children}</>;
}
