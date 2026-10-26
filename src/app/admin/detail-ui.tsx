import Link from "next/link";
import { ArrowLeft, Check, CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { quietText } from "./ui";

// Layout primitives shared by the Order, Card and Stock detail pages so they keep one rhythm. Spacing scale (px):
//   4 label→value      8 header title→metadata   12 row gap    16 compact card padding / row padding
//   24 card padding (sm+) / grid gutter / section→section on phones      32 section→section on desktop
// Cards at the same grid level stretch so they share top and bottom edges; stack them if they cannot balance.

const cardPad = "p-4 sm:p-6";
const rowPad = "px-4 sm:px-6";

/** Link to another record: normal foreground, underlined, never the accent colour. */
export const recordLink = "text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-brand";
export const wrapText = "break-words [overflow-wrap:anywhere]";

// ---------------------------------------------------------------------------------------------------------------
// Header

export type MetaItem = { icon?: LucideIcon; text: ReactNode; tone?: "default" | "attention" };

/** Plain-text facts separated by middots, each with an optional quiet icon. Never pills. */
export function MetaRow({ items }: { items: (MetaItem | false | null | undefined)[] }) {
  const shown = items.filter((item): item is MetaItem => Boolean(item));
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-fg-secondary", wrapText)}>
      {shown.map((item, index) => (
        <span key={index} className="inline-flex items-center gap-x-2">
          {index > 0 ? <span aria-hidden>·</span> : null}
          <span className={cn("inline-flex items-center gap-1.5", item.tone === "attention" && "text-foreground")}>
            {item.icon ? <item.icon aria-hidden className={cn("size-3.5 shrink-0", item.tone === "attention" ? "text-amber-600" : "text-fg-faint")} /> : null}
            {item.text}
          </span>
        </span>
      ))}
    </p>
  );
}

/** Back link, title, an optional supporting line and a metadata row on the left; actions on the right. */
export function DetailHeader({ back, title, subtitle, meta, actions }: { back: { href: string; label: string }; title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-2">
      <Link href={back.href} className="group -ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md px-1 text-meta font-medium text-fg-secondary nav-interact transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand md:min-h-8">
        <ArrowLeft aria-hidden className="size-3.5" />
        {back.label}
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h1 className={cn("text-[1.375rem] leading-7 font-semibold tracking-tight", wrapText)}>{title}</h1>
            {subtitle ? <div className={cn("text-body text-fg-secondary", wrapText)}>{subtitle}</div> : null}
          </div>
          {meta}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 max-sm:[&>*]:flex-1">{actions}</div> : null}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Surfaces

/** A titled card. The title sits in a header row so every card on a page starts at the same height. */
export function Card({ title, icon: Icon, description, actions, children, className, id, flush = false }: { title: ReactNode; icon?: LucideIcon; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string; flush?: boolean }) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex min-w-0 shrink-0 flex-col overflow-hidden rounded-panel border bg-background", className)}>
      <header className={cn("flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b py-3", rowPad)}>
        <div className="flex min-w-0 flex-col">
          <h2 id={headingId} className="flex items-center gap-2 text-section">{Icon ? <Icon aria-hidden className="size-4 text-fg-secondary" /> : null}{title}</h2>
          {description ? <p className={quietText}>{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className={cn("flex flex-1 flex-col gap-4", flush ? "" : cardPad)}>{children}</div>
    </section>
  );
}

/** Rows divided by hairlines inside a flush Card. */
export function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y">{children}</ul>;
}

/** The operational state of the record: what is true now and, if anything remains, the one thing to do. */
export function StatePanel({ title, icon: Icon, description, tone = "quiet", children, footer }: { title: string; icon?: LucideIcon; description?: ReactNode; tone?: "action" | "quiet"; children?: ReactNode; footer?: ReactNode }) {
  return (
    <section data-primary-task="" className={cn("flex shrink-0 flex-col overflow-hidden rounded-panel border bg-background", tone === "action" ? "border-action/40" : "border-border")}>
      <div className={cn("flex flex-col gap-4", cardPad)}>
        <div className="flex items-start gap-3">
          {Icon ? <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone === "action" ? "bg-action/10 text-action-text" : "bg-subtle text-fg-secondary")}><Icon className="size-4" /></span> : null}
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-section">{title}</h2>
            {description ? <div className={cn("max-w-prose text-body text-fg-secondary", wrapText)}>{description}</div> : null}
          </div>
        </div>
        {children}
      </div>
      {footer ? <div className="border-t">{footer}</div> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Facts

/** Labelled facts. `columns` splits the list into two aligned columns from md up for wide cards. */
export function KeyValueList({ rows, columns = 1 }: { rows: ([ReactNode, ReactNode] | false | null | undefined)[]; columns?: 1 | 2 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 text-body", columns === 2 ? "md:grid-cols-2" : "grid-cols-1")}>
      {rows.flatMap((row, index) => (row ? [
        <div key={index} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          <dt className="text-fg-secondary">{row[0]}</dt>
          <dd className={cn("min-w-0", wrapText)}>{row[1]}</dd>
        </div>,
      ] : []))}
    </dl>
  );
}

/** A state in words: an optional quiet icon and text, with no dot, pill or fill. `attention` is for work still owed. */
export function StateText({ children, icon: Icon, tone = "neutral" }: { children: ReactNode; icon?: LucideIcon; tone?: "neutral" | "attention" | "danger" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-body text-foreground">
      {Icon ? <Icon aria-hidden className={cn("size-3.5 shrink-0", tone === "attention" ? "text-amber-600" : tone === "danger" ? "text-destructive" : "text-fg-faint")} /> : null}
      {children}
    </span>
  );
}

/** One line at the foot of a card: the settled outcome, or the work that remains. */
export function OutcomeRow({ done, children }: { done: boolean; children: ReactNode }) {
  const Icon = done ? Check : CircleAlert;
  return (
    <p className={cn("flex items-start gap-2 border-t bg-canvas/60 py-3 text-meta", rowPad, done ? "text-fg-secondary" : "text-foreground")}>
      <Icon aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", done ? "text-fg-faint" : "text-amber-600")} />
      <span className={wrapText}>{children}</span>
    </p>
  );
}

/** A grid of equal cells (label over value) on one surface; cells never differ in height or padding. `text` values are
 *  words rather than figures; `embedded` drops the outer border for use inside a StatePanel footer. */
export function SummaryStrip({ items, label, columns = 4, text = false, embedded = false }: { items: { label: string; value: ReactNode; hint?: ReactNode }[]; label?: string; columns?: 3 | 4; text?: boolean; embedded?: boolean }) {
  const hinted = items.some((item) => item.hint);
  return (
    <dl aria-label={label} className={cn("grid shrink-0 grid-cols-2 gap-px bg-border", columns === 4 ? "md:grid-cols-4" : "md:grid-cols-3", !embedded && "overflow-hidden rounded-panel border", items.length % 2 === 1 && "max-md:[&>*:last-child]:col-span-2")}>
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-1 bg-background px-4 py-4 sm:px-6">
          <dt className="text-meta text-fg-secondary">{item.label}</dt>
          <dd className={cn(text ? "text-body leading-7 font-medium" : "text-[1.25rem] leading-7 font-semibold tracking-tight tabular-nums", wrapText)}>{item.value}</dd>
          {hinted ? <dd className={cn(quietText, "min-h-4 text-label")}>{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Activity

export type TimelineEntry = { id: string; title: string; detail?: string; at: Date };

function TimelineEntries({ entries, latest, connected }: { entries: TimelineEntry[]; latest?: boolean; connected: boolean }) {
  return (
    <ul>
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;
        return (
          <li key={entry.id} className={cn("relative ml-[3px] min-h-12 border-l pb-4 pl-5", last && !connected && "border-transparent pb-0 min-h-0")}>
            <span aria-hidden className={cn("absolute top-1.5 -left-[4px] size-[7px] rounded-full", latest && index === 0 ? "bg-foreground" : "bg-border-strong")} />
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <p className={cn("min-w-0 text-body font-medium", wrapText)}>{entry.title}</p>
              <time dateTime={entry.at.toISOString()} className="shrink-0 text-label tabular-nums text-fg-secondary">{formatDateTime(entry.at)}</time>
            </div>
            {entry.detail ? <p className={cn(quietText, wrapText)}>{entry.detail}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Newest first, as a Card body: the latest few events, the rest one click away. */
export function Timeline({ entries, limit = 5 }: { entries: TimelineEntry[]; limit?: number }) {
  if (!entries.length) return <p className={quietText}>No activity yet.</p>;
  const older = entries.slice(limit);
  return (
    <div className="flex flex-col">
      <TimelineEntries entries={entries.slice(0, limit)} latest connected={older.length > 0} />
      {older.length ? (
        <details className="group/older">
          <summary className="-mt-1 mb-3 ml-[3px] flex min-h-11 w-fit cursor-pointer list-none items-center rounded-md pl-5 text-meta font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-brand md:min-h-9 [&::-webkit-details-marker]:hidden">
            <span className="group-open/older:hidden">View all activity</span>
            <span className="hidden group-open/older:inline">Show fewer</span>
          </summary>
          <TimelineEntries entries={older} connected={false} />
        </details>
      ) : null}
    </div>
  );
}
