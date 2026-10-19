import { CalendarDays, Globe, Link2, ShoppingBag, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { LinkKind } from "@/modules/profiles/block-options";
import { PLATFORMS } from "@/modules/profiles/platform-registry";
import { cn } from "@/lib/utils";

// Brand marks from Simple Icons (CC0), drawn white on each platform's own color.

const GENERIC: Record<string, LucideIcon> = { portfolio: Globe, booking: CalendarDays, shop: ShoppingBag, menu: UtensilsCrossed };

export function LinkKindIcon({ kind, className }: { kind: LinkKind; className?: string }) {
  const brand = PLATFORMS[kind].brand;
  if (brand) return (
    <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]", className)} style={{ background: brand.color }}>
      <svg viewBox="0 0 24 24" className="size-5 fill-white"><path d={brand.path} /></svg>
    </span>
  );
  const Icon = GENERIC[kind] ?? Link2;
  return (
    <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas", className)}>
      <Icon className="size-[1.125rem] text-foreground" strokeWidth={1.6} />
    </span>
  );
}
