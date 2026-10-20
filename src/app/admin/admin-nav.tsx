"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { activeSection, navGroups } from "./nav-sections";

// Active state comes from the URL, not from page markup: Next keeps visited pages mounted (hidden) for instant
// back navigation, so a DOM-based `:has()` highlight matched every section the owner had already opened.
// Used twice: in the desktop sidebar and, with larger targets and `onNavigate`, inside the phone menu sheet.
export function AdminNav({ comfortable = false, onNavigate, basePath = "/admin" }: { comfortable?: boolean; onNavigate?: () => void; basePath?: string }) {
  const current = activeSection(usePathname()?.replace(basePath, "/admin") ?? null);
  return (
    <nav aria-label="Owner navigation" className="flex flex-col gap-5">
      {navGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p id={`nav-${comfortable ? "sheet" : "side"}-${group.label}`} className="px-3 pb-0.5 text-label font-medium tracking-wide text-fg-faint uppercase">{group.label}</p>
          <ul aria-labelledby={`nav-${comfortable ? "sheet" : "side"}-${group.label}`} className="flex flex-col gap-0.5">
            {group.items.map(({ key, title, href, icon: Icon }) => {
              const active = key === current;
              return (
                <li key={key}>
                  <Link
                    href={href.replace(/^\/admin/, basePath)}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group/nav relative flex items-center gap-2.5 rounded-lg px-3 text-nav nav-interact transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                      comfortable ? "min-h-11" : "min-h-9",
                      active
                        ? "bg-subtle font-semibold text-foreground"
                        : "text-fg-secondary hover:bg-canvas hover:text-foreground active:bg-subtle",
                    )}
                  >
                    <Icon aria-hidden className={cn("size-4 shrink-0 nav-interact transition-colors", active ? "text-brand" : "text-fg-secondary group-hover/nav:text-foreground")} />
                    {title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
