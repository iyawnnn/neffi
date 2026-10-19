import { ArrowRight, IdCard, Nfc, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Customer-app building blocks shared by Home and, later, Profiles, Cards and Account.
// Surfaces: the Snow canvas, a white panel (rounded-panel, hairline border), and interactive rows/tiles inside it.

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: "default" | "action" | "outline" | "ghost" };

// A link styled as a button: 48px on phones, 44px from sm, identical geometry for every variant so a primary and
// its secondary always line up. `action` is the one Vermilion primary per screen; `outline` the quiet Snow secondary.
export function ButtonLink({ variant = "default", className, ...props }: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        buttonVariants({ variant, size: "touch" }),
        "h-12 rounded-[10px] px-5 text-[0.875rem] leading-5 font-medium focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:h-11 sm:px-4",
        variant === "action" && "font-semibold active:bg-action-hover",
        variant === "outline" && "border-border bg-background text-foreground hover:border-border-strong hover:bg-canvas active:bg-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({ id, title, count, action }: { id: string; title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-end justify-between gap-4 pb-3">
      <h2 id={id} className="flex items-baseline gap-2 text-section">
        {title}
        {count ? <span className="text-meta tabular-nums text-fg-secondary">{count}</span> : null}
      </h2>
      {action}
    </div>
  );
}

export function CountBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex shrink-0 items-center rounded-md border border-border/70 bg-canvas px-2 py-0.5 text-label tabular-nums text-fg-secondary">{children}</span>;
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group cursor-pointer -mr-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-meta font-medium text-fg-secondary nav-interact transition-colors hover:text-foreground active:text-foreground focus-visible:outline-2 focus-visible:outline-brand">
      {children}
      <ArrowRight aria-hidden className="size-3.5 nav-interact nav-arrow" />
    </Link>
  );
}

// A list that is one object: heading row (title, count, link) inside a single panel, rows below it.
export function ListPanel({ id, title, count, action, children }: { id: string; title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-panel border bg-background">
      <div className="flex h-14 items-center justify-between gap-4 px-5 md:px-6">
        <h2 id={id} className="flex items-baseline gap-2 text-section">
          {title}
          {count ? <CountBadge>{count}</CountBadge> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function RowList({ children }: { children: ReactNode }) {
  return <ul className="divide-y">{children}</ul>;
}

export function Row({ href, leading, title, meta, status, trailing }: { href: string; leading: ReactNode; title: ReactNode; meta?: ReactNode; status?: ReactNode; trailing?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex min-h-[4.5rem] cursor-pointer items-center gap-3.5 px-5 py-3 nav-interact transition-colors hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand md:px-6">
        {leading}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-entity">{title}</span>
          {meta ? <span className="truncate text-meta text-fg-secondary">{meta}</span> : null}
        </span>
        {status}
        {trailing}
        <ArrowRight aria-hidden className="size-4 shrink-0 nav-interact nav-arrow" />
      </Link>
    </li>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-9 text-center">
      <span aria-hidden className="mb-3 inline-flex size-10 items-center justify-center rounded-full border bg-canvas">
        <Icon className="size-[1.125rem] text-fg-secondary" strokeWidth={1.6} />
      </span>
      <p className="text-entity">{title}</p>
      <p className="max-w-xs text-meta text-fg-secondary">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

export function ProfileAvatar({ name, size = "md" }: { name: string | null; size?: "md" | "lg" }) {
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full border bg-canvas font-medium text-foreground", size === "lg" ? "size-12 text-[0.9375rem] tracking-[-0.01em]" : "size-10 text-meta")}>
      {name?.trim() ? initials(name) : <UserRound className={size === "lg" ? "size-5" : "size-[1.125rem]"} strokeWidth={1.6} />}
    </span>
  );
}

// A profile is shown by a neutral rounded-square contact/ID card object tile, never by an avatar or initials.
export function ProfileGlyph({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas nav-interact transition-colors group-hover:bg-subtle", className)}>
      <IdCard className="size-[1.125rem] text-foreground" strokeWidth={1.6} />
    </span>
  );
}

// A card is shown by the tap glyph in a neutral rounded-square tile, matching the profile object tile.
export function CardGlyph() {
  return (
    <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas nav-interact transition-colors group-hover:bg-subtle">
      <Nfc className="size-[1.125rem] text-foreground" strokeWidth={1.7} />
    </span>
  );
}

const statuses = {
  draft: { label: "Draft", className: "bg-canvas text-fg-secondary shadow-[inset_0_0_0_1px_var(--border-strong)]" },
  published: { label: "Published" },
  unpublished: { label: "Unpublished", className: "bg-subtle text-fg-secondary" },
} as const;

export function ProfileStatus({ status }: { status: keyof typeof statuses }) {
  if (status === "published") return <PositiveStatus>Published</PositiveStatus>;
  return <span className={cn(badgeVariants({ variant: "secondary" }), "h-[1.375rem] shrink-0 rounded-full border-0 px-2 text-label", statuses[status].className)}>{statuses[status].label}</span>;
}

export function PositiveStatus({ children }: { children: ReactNode }) {
  return <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-brand/20 bg-brand/5 px-2 py-0.5 text-label text-action-text"><span aria-hidden className="size-1 rounded-full bg-current" />{children}</span>;
}
