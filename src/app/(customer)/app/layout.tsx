import type { Metadata } from "next";
import { requireAccount } from "@/auth/access";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { db } from "@/db";
import { accountDisplayName } from "@/modules/accounts/directory";
import { unreadCount } from "@/modules/forms/submissions";
import { AppHeader, AppNav } from "./app-nav";

// Customer surface (/app/*). Private and never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Reads the session, so it renders per request. The gate runs before any child renders; pages check again
// because layouts do not re-run on client-side navigation between pages.
export const instant = false;

export default async function CustomerLayout({ children }: LayoutProps<"/app">) {
  const viewer = await requireAccount("/app");
  const [name, unread] = await Promise.all([accountDisplayName(db, viewer.accountId), unreadCount(db, viewer.accountId)]);
  return (
    <div className="app-type flex flex-1 flex-col has-[main[data-canvas]]:bg-canvas has-[main[data-setup]]:bg-canvas">
      <AppHeader account={{ name, email: viewer.email }} unread={unread} />
      {/* Reserve space for the floating dock and safe area on every screen; focused setup has no dock. */}
      <div className="flex flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+6.625rem)] has-[main[data-setup]]:pb-0">{children}</div>
      <AppNav />
      <SessionKeepAlive />
    </div>
  );
}
