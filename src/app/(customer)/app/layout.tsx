import type { Metadata } from "next";
import { requireAccount } from "@/auth/access";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { AppNav } from "./app-nav";

// Customer surface (/app/*). Private and never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Reads the session, so it renders per request. The gate runs before any child renders; pages check again
// because layouts do not re-run on client-side navigation between pages.
export const instant = false;

export default async function CustomerLayout({ children }: LayoutProps<"/app">) {
  await requireAccount("/app");
  return (
    <>
      <div className="flex flex-1 flex-col pb-24">{children}</div>
      <AppNav />
      <SessionKeepAlive />
    </>
  );
}
