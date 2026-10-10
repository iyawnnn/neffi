import type { Metadata } from "next";
import { requireOwner } from "@/auth/access";
import { SessionKeepAlive } from "@/components/session-keep-alive";

// Owner/admin surface (/admin/*). Private and never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// OWNER-only, decided on the server before anything renders; everyone else gets a 404 or the sign-in page.
// Pages check again (layouts do not re-run on client-side navigation). MFA/step-up arrives in Milestone 10.
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireOwner();
  return (
    <>
      {children}
      <SessionKeepAlive />
    </>
  );
}
