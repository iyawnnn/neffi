import type { Metadata } from "next";

// Owner/admin surface (/admin/*). Private and never indexed; OWNER authorization arrives in Milestone 3.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <>{children}</>;
}
