import type { Metadata } from "next";
import { requireOwner } from "@/auth/access";
import { AdminShell } from "./shell";

// Owner/admin surface (/admin/*). Private and never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// OWNER-only, decided on the server before anything renders; everyone else gets a 404 or the sign-in page.
// Pages check again (layouts do not re-run on client-side navigation). MFA/step-up is deferred until team growth or Production setup.
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const viewer = await requireOwner();
  return <AdminShell email={viewer.email}>{children}</AdminShell>;
}
