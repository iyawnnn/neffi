import type { ReactNode } from "react";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { AccountMenu } from "./account-menu";
import { AdminFrame } from "./admin-frame";
import { CommandMenu } from "./command-menu";

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  return <AdminFrame account={<AccountMenu email={email} />} palette={<><CommandMenu /><SessionKeepAlive /></>}>{children}</AdminFrame>;
}
