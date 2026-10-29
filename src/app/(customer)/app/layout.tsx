import type { Metadata } from "next";
import { requireAccount } from "@/auth/access";
import { isOwner } from "@/auth/policy";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { db } from "@/db";
import { accountHeaderDetails } from "@/modules/accounts/directory";
import { unreadCount } from "@/modules/forms/submissions";
import { AppContent, AppHeader, AppNav } from "./app-nav";

// Customer surface (/app/*). Private and never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Reads the session, so it renders per request. The gate runs before any child renders; pages check again
// because layouts do not re-run on client-side navigation between pages.
export const instant = false;

export default async function CustomerLayout({ children }: LayoutProps<"/app">) {
  const viewer = await requireAccount("/app");
  const [details, unread] = await Promise.all([accountHeaderDetails(db, viewer.accountId), unreadCount(db, viewer.accountId)]);
  return (
    <div className="app-type flex flex-1 flex-col has-[main[data-canvas]]:bg-canvas has-[main[data-setup]]:bg-canvas">
      <AppHeader account={{ ...details, email: viewer.email }} unread={unread} owner={isOwner(viewer)} />
      {/* Reserve mobile dock and safe-area clearance; desktop and focused setup have no bottom dock. */}
      <AppContent>{children}</AppContent>
      <AppNav />
      <SessionKeepAlive />
    </div>
  );
}
