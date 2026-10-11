"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [["Home", "/app"], ["Profiles", "/app/profiles"], ["Cards", "/app/cards"], ["Account", "/app/account"]] as const;

export function AppNav() {
  const pathname = usePathname();
  return <nav aria-label="Main" className="fixed inset-x-0 bottom-0 border-t bg-background"><ul className="mx-auto grid max-w-md grid-cols-4">
    {sections.map(([label, href]) => {
      const current = pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
      return <li key={href}><Link href={href} aria-current={current ? "page" : undefined} className={`inline-flex min-h-11 w-full flex-col items-center justify-center text-xs ${current ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</Link></li>;
    })}
  </ul></nav>;
}
