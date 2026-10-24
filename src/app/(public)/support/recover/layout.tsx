import type { ReactNode } from "react";
import { FocusedUtilityLayout } from "@/components/public-site-shell";

export default function RecoveryLayout({ children }: { children: ReactNode }) {
  return <FocusedUtilityLayout recovery>{children}</FocusedUtilityLayout>;
}
