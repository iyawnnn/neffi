import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/auth/access";
import { isOwner } from "@/auth/policy";
import { AdminShell } from "./shell";

// Owner/admin surface (/admin/*). Private and never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// OWNER-only. Signed-in non-owners get a 404 here; a signed-out visitor is left to each page's own owner gate so the
// redirect keeps the exact destination. Pages check again (layouts do not re-run on client-side navigation) and no
// data is fetched here. MFA/step-up is deferred until team growth or Production setup.
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const viewer = await getViewer();
  if (!viewer) return children;
  if (!isOwner(viewer)) notFound();
  return <AdminShell email={viewer.email}>{children}</AdminShell>;
}
