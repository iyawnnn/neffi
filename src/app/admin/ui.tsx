import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CircleAlert, Info, ListFilter, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pageNumbers, type PageWindow } from "@/modules/pagination";
import { InfoTip } from "./info-tip";

// Shared admin presentation. One page width, one header, one table, one status and one form language so every
// owner screen reads as the same product. Presentation only: nothing here knows about data or permissions.
//
// Layout rhythm (phone → desktop), used by every screen:
//   page gutter 16 → 24 → 40      page top/bottom 24 → 36
//   header → first section and section → section 24 → 32
//   section title → content 16    panel padding 16 → 20    table cell 16 × 12
//   form field gap 16             form section gap 24 (a divided panel, see FormSection)

/** Page container. Pages keep `<main data-admin-section="…">` so the page markers stay greppable. */
const pageBase = "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 sm:px-6 lg:gap-8 lg:px-10 lg:py-9";
const panelPad = "p-4 sm:p-5";
export const adminPage = `${pageBase} max-w-[1120px]`;
/** Dashboard, long tables and the support workspace: more room for columns and charts. */
export const adminPageWide = `${pageBase} max-w-[1280px]`;
/** Single-column forms and settings: a comfortable measure. */
export const adminPageNarrow = `${pageBase} max-w-[880px]`;

/** Builds a list URL from only the params that have a value, so filters survive paging and stay out of clean URLs. */
export function listHref(path: string, params: Record<string, string | undefined | null>) {
  const query = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => (value ? [[key, value]] : [])));
  return query.size ? `${path}?${query}` : path;
}

/** Href builder for numbered pages: keeps the active filters and leaves `page` out of the first page's URL. */
export const pageHref = (path: string, keep: Record<string, string | undefined | null>) => (page: number) => listHref(path, { ...keep, page: page > 1 ? String(page) : undefined });

// ---------------------------------------------------------------------------------------------------------------
// Header

export function PageHeader({ title, description, back, actions, actionsLabel }: { title: ReactNode; description?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode; actionsLabel?: string }) {
  return (
    <header className="flex flex-col gap-3">
      {back ? (
        <Link href={back.href} className="group -ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md px-1 text-meta font-medium text-fg-secondary nav-interact transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand md:min-h-8">
          <ArrowLeft aria-hidden className="size-3.5" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="break-words text-[1.375rem] leading-7 font-semibold tracking-tight">{title}</h1>
          {description ? <div className="max-w-prose text-body text-fg-secondary">{description}</div> : null}
        </div>
        {/* Phones: the actions sit under the title and share the row, so one reads as a full-width primary. */}
        {actions ? <div role={actionsLabel ? "group" : undefined} aria-label={actionsLabel} className="flex flex-wrap items-center gap-2 max-sm:[&>*]:flex-1 max-sm:[&>*]:basis-[calc(50%-0.25rem)]">{actions}</div> : null}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Sections and surfaces

export function Section({ title, description, actions, children, id, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="text-section">{title}</h2>
          {description ? <p className="max-w-prose text-meta text-fg-secondary">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** A white bordered surface. Use for tables and primary forms; plain Sections elsewhere to avoid card soup. */
export function Panel({ children, className, padded = false }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cn("overflow-hidden rounded-panel border bg-background", padded && panelPad, className)}>{children}</div>;
}

/** Highlights the single next thing to do on a screen: the Vermilion hairline is the only accent. */
export function NextStep({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-panel border border-action/40 bg-background", panelPad)}>
      <h2 className="text-section">{title}</h2>
      {children}
    </section>
  );
}

/** Separated, quiet group for destructive or system actions. */
export function DangerZone({ title = "Danger zone", children }: { title?: string; children: ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-panel border border-destructive/30 bg-background", panelPad)}>
      <h2 className="text-section text-destructive">{title}</h2>
      {children}
    </section>
  );
}

/** A divided stack of titled form sections inside one panel: the shape of every multi-part form. */
export function FormPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 flex-col divide-y overflow-hidden rounded-panel border bg-background", className)}>{children}</div>;
}

export function FormSection({ icon: Icon, title, description, children }: { icon?: LucideIcon; title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-4", panelPad)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-2 text-section">{Icon ? <Icon aria-hidden className="size-4 text-fg-secondary" /> : null}{title}</h2>
        {description ? <p className="text-meta text-fg-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Key facts

export function StatStrip({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode }[] }) {
  // Cells carry right/bottom borders and the grid is pulled out by 1px, so an incomplete last row stays clean.
  return (
    <div className="overflow-hidden rounded-panel border bg-background">
      <dl className="-mr-px -mb-px grid grid-cols-2 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col gap-1 border-r border-b px-4 py-3.5 md:px-5">
            <dt className="text-meta text-fg-secondary">{item.label}</dt>
            <dd className="truncate text-[1.125rem] leading-6 font-semibold tabular-nums">{item.value}</dd>
            {item.hint ? <dd className="text-label text-fg-secondary">{item.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DetailList({ rows }: { rows: ([ReactNode, ReactNode] | false | null | undefined)[] }) {
  return (
    <dl className="grid grid-cols-[minmax(6.5rem,max-content)_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-body">
      {rows.flatMap((row, index) => (row ? [<dt key={`t${index}`} className="text-fg-secondary">{row[0]}</dt>, <dd key={`d${index}`} className="min-w-0 break-words">{row[1]}</dd>] : []))}
    </dl>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Status: a small dot plus plain text, never a filled pill.

export type Tone = "neutral" | "attention" | "success" | "warning" | "danger";
const dot: Record<Tone, string> = { neutral: "bg-fg-faint", attention: "bg-brand", success: "bg-emerald-600", warning: "bg-amber-500", danger: "bg-destructive" };

export function Status({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-meta font-medium whitespace-nowrap text-foreground">
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dot[tone])} />
      {children}
    </span>
  );
}

export const orderTone = (status: string): Tone => (status === "completed" ? "success" : status === "in_progress" ? "warning" : "neutral");
export const cardTone = (state: string, provisioning = false): Tone => (provisioning ? "warning" : state === "ready" || state === "released" ? "success" : state === "reserved" ? "warning" : "neutral");
export const caseTone = (status: string): Tone => (status === "open" ? "attention" : status === "waiting_on_customer" ? "warning" : "success");
export const shipmentTone = (status: string): Tone => (status === "delivered" ? "success" : status === "failed" || status === "returned" || status === "lost" ? "danger" : status === "in_transit" || status === "pending" ? "warning" : "neutral");
export const recoveryTone = (status: string): Tone => (status === "completed" ? "success" : status === "pending" ? "warning" : "neutral");
export const label = (value: string | null | undefined) => (value ?? "").replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase());

// ---------------------------------------------------------------------------------------------------------------
// Links and buttons

/** Inline text link inside body copy. */
export const inlineLink = "font-medium text-action-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand";
/** Muted supporting text. */
export const quietText = "text-meta text-fg-secondary";

/** Text link with the Neffi arrow: → at rest, ↗ and Vermilion on hover. */
export function TextLink({ children, className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link className={cn("group inline-flex min-h-11 items-center gap-1 rounded-md text-meta font-medium text-action-text nav-interact transition-colors hover:text-action-hover focus-visible:outline-2 focus-visible:outline-brand md:min-h-8", className)} {...props}>
      {children}
      <ArrowRight aria-hidden className="size-3.5 nav-interact nav-arrow" />
    </Link>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: "action" | "outline" | "ghost"; icon?: LucideIcon };

/** A link styled as a button: 44px on phones, compact from md. */
export function LinkButton({ variant = "outline", icon: Icon, className, children, ...props }: LinkButtonProps) {
  return (
    <Link
      className={cn(
        buttonVariants({ variant, size: "touch" }),
        "rounded-lg text-body font-medium nav-interact focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:h-9",
        variant === "action" && "font-semibold text-white hover:text-white",
        variant === "outline" && "text-foreground",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Forms

const control = "w-full rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none nav-interact transition-colors placeholder:text-fg-faint hover:border-border-strong focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-secondary md:text-body";
export const controlClass = cn(control, "h-11 md:h-9");
export const fieldLabel = "flex flex-col gap-1.5 text-meta font-medium text-foreground";
export const checkLabel = "flex min-h-11 items-start gap-2.5 py-2.5 text-body md:min-h-8 md:py-1.5 [&>input]:mt-0.5";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClass, "pr-8", className)} {...props} />;
}

export function Field({ label: text, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className={fieldLabel}>
      {text}
      {children}
      {hint ? <span className="text-label font-normal text-fg-secondary">{hint}</span> : null}
    </label>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Filters: one pattern for inventory, orders, customers and support.

export function FilterBar({ children, action, clearHref, submit = "Apply" }: { children: ReactNode; action?: string; clearHref?: string; submit?: string }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-x-3 gap-y-3 border-y py-4">
      {children}
      <div className="flex items-center gap-1">
        <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "touch" }), "rounded-lg border-border bg-background text-body font-medium hover:border-border-strong hover:bg-canvas md:h-9")}><ListFilter aria-hidden />{submit}</button>
        {clearHref ? <Link href={clearHref} className="inline-flex min-h-11 items-center gap-1 rounded-md px-2.5 text-meta font-medium text-action-text nav-interact transition-colors hover:text-action-hover focus-visible:outline-2 focus-visible:outline-brand md:min-h-9"><X aria-hidden className="size-3.5" />Clear filters</Link> : null}
      </div>
    </form>
  );
}

export function FilterField({ label: text, children, grow = false }: { label: string; children: ReactNode; grow?: boolean }) {
  return (
    <label className={cn("flex min-w-[9rem] flex-col gap-1.5 text-meta font-medium", grow ? "min-w-[14rem] flex-1" : "max-sm:flex-1")}>
      {text}
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Records: one list, two shapes. md+ is a real <table>; phones get one tappable row per record with its status and
// the few figures that matter. Only one of the two is ever displayed, so nothing is duplicated for assistive tech.

export type RecordColumn<T> = { label: string; cell: (row: T) => ReactNode; align?: "right"; className?: string };

export type MobileRecord = {
  title: ReactNode;
  status?: ReactNode;
  subtitle?: ReactNode;
  /** Short label/value pairs on one line, e.g. Balance ₱500.00. */
  figures?: [string, ReactNode][];
  meta?: ReactNode;
  cta?: string;
  /** For rows with no page of their own: a control (an Edit sheet trigger) in place of the link arrow. */
  action?: ReactNode;
};

export function RecordTable<T>({ caption, rows, rowKey, href, columns, mobile }: { caption: string; rows: T[]; rowKey: (row: T) => string; href: (row: T) => string | undefined; columns: RecordColumn<T>[]; mobile: (row: T) => MobileRecord }) {
  return (
    <>
      <Panel className="max-md:hidden">
        <table className="w-full text-left text-body">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b bg-canvas/60">
              {columns.map((column) => (
                <th key={column.label} scope="col" className={cn("h-9 px-4 text-label font-medium text-fg-secondary first:pl-5 last:pr-5", column.align === "right" && "text-right", column.className)}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="group relative nav-interact transition-colors hover:bg-canvas focus-within:bg-canvas">
                {columns.map((column, index) => (
                  <td key={column.label} className={cn("px-4 py-3 align-middle first:pl-5 last:pr-5", index === 0 && "min-w-0", column.align === "right" && "text-right tabular-nums", column.className)}>{column.cell(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <ul aria-label={caption} className="divide-y overflow-hidden rounded-panel border bg-background md:hidden">
        {rows.map((row) => {
          const { title, status, subtitle, figures, meta, cta, action } = mobile(row);
          const target = href(row);
          const body = (
            <>
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words text-body font-medium text-foreground">{title}</span>
                {status ? <span className="shrink-0">{status}</span> : null}
              </span>
              {subtitle ? <span className="break-words text-meta text-fg-secondary">{subtitle}</span> : null}
              {figures?.length ? <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-meta tabular-nums">{figures.map(([name, value]) => <span key={name} className="text-fg-secondary">{name} <span className="font-medium text-foreground">{value}</span></span>)}</span> : null}
              <span className="flex items-center justify-between gap-3 text-meta">
                <span className="min-w-0 text-fg-secondary">{meta}</span>
                {target ? <span className="inline-flex shrink-0 items-center gap-1 font-medium text-action-text">{cta ?? "View"}<ArrowRight aria-hidden className="size-3.5 nav-interact nav-arrow" /></span> : action}
              </span>
            </>
          );
          return (
            <li key={rowKey(row)}>
              {target
                ? <Link href={target} className="group flex min-h-[4.5rem] flex-col gap-1.5 px-4 py-3.5 nav-interact transition-colors hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">{body}</Link>
                : <div className="flex min-h-[4.5rem] flex-col gap-1.5 px-4 py-3.5">{body}</div>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** The primary link in a desktop row: it stretches over the whole row so the entire line is clickable. */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-medium text-foreground outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand">{children}</Link>;
}

/** Muted second line inside a primary cell. */
export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("break-words text-meta text-fg-secondary", className)}>{children}</p>;
}

/**
 * Numbered pagination from a real total: "Showing 21–40 of 148 orders", Previous, page numbers and Next. Phones
 * get Previous, "Page 2 of 8" and Next. Disabled ends stay visible so the control never jumps.
 */
export function Pagination({ paging, noun, hrefFor }: { paging: PageWindow; noun: string; hrefFor: (page: number) => string }) {
  const { page, pageCount, from, to, total } = paging;
  if (!total) return null;
  const word = total === 1 && noun.endsWith("s") ? noun.slice(0, -1) : noun;
  const step = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-body font-medium nav-interact transition-colors duration-200 md:h-9 md:min-h-9";
  const live = "hover:border-border-strong hover:bg-canvas active:bg-subtle focus-visible:outline-2 focus-visible:outline-brand";
  const idle = "cursor-not-allowed text-fg-faint";
  const previous = page > 1 ? <Link href={hrefFor(page - 1)} rel="prev" className={cn(step, live)}><ChevronLeft aria-hidden className="size-4" />Previous</Link> : <span aria-disabled="true" className={cn(step, idle)}><ChevronLeft aria-hidden className="size-4" />Previous</span>;
  const next = page < pageCount ? <Link href={hrefFor(page + 1)} rel="next" className={cn(step, live)}>Next<ChevronRight aria-hidden className="size-4" /></Link> : <span aria-disabled="true" className={cn(step, idle)}>Next<ChevronRight aria-hidden className="size-4" /></span>;
  return (
    <nav aria-label={`${noun} pagination`} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-meta text-fg-secondary tabular-nums" role="status">Showing {from}–{to} of {total} {word}</p>
      {pageCount > 1 ? (
        <>
          <ul className="hidden items-center gap-1.5 sm:flex">
            <li>{previous}</li>
            {pageNumbers(paging).map((number, index) => number === null ? (
              <li key={`gap-${index}`} aria-hidden className="px-1 text-fg-faint">…</li>
            ) : (
              <li key={number}>
                <Link href={hrefFor(number)} aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} className={cn("inline-flex size-11 items-center justify-center rounded-lg border bg-background text-body tabular-nums md:size-9 nav-interact transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-brand", number === page ? "border-action/50 bg-action/5 font-semibold text-action-text hover:border-action hover:bg-action/10" : "border-border text-fg-secondary hover:border-border-strong hover:bg-canvas hover:text-foreground")}>{number}</Link>
              </li>
            ))}
            <li>{next}</li>
          </ul>
          <div className="flex items-center justify-between gap-3 sm:hidden">
            {previous}
            <span className="text-meta text-fg-secondary tabular-nums">Page {page} of {pageCount}</span>
            {next}
          </div>
        </>
      ) : null}
    </nav>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Empty state

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center sm:py-12">
      <span className="flex size-9 items-center justify-center rounded-full border bg-canvas text-fg-secondary"><Icon aria-hidden className="size-4" /></span>
      <div className="flex flex-col gap-1">
        <p className="text-section">{title}</p>
        {children ? <p className="max-w-sm text-meta text-fg-secondary">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** An empty collection inside its own bordered surface. */
export function EmptyPanel(props: ComponentProps<typeof EmptyState>) {
  return <Panel><EmptyState {...props} /></Panel>;
}

// ---------------------------------------------------------------------------------------------------------------
// Tabs: plain links, so the active view lives in the URL and works without JavaScript.

export function TabNav({ label: ariaLabel, items }: { label: string; items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={ariaLabel} className="-mb-2 flex gap-1 border-b">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn("-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-nav nav-interact transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand md:min-h-10", item.active ? "border-action text-foreground" : "border-transparent text-fg-secondary hover:text-foreground")}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Notice: a compact inline message with a direct action. Only for real, actionable state.

const noticeTone = { info: ["border-border bg-background", "text-fg-secondary", Info], attention: ["border-action/30 bg-action/5", "text-action-text", CircleAlert], warning: ["border-amber-500/40 bg-amber-500/5", "text-amber-600", TriangleAlert] } as const;

export function Notice({ tone = "info", title, children, action }: { tone?: keyof typeof noticeTone; title: string; children?: ReactNode; action?: ReactNode }) {
  const [surface, iconTone, Icon] = noticeTone[tone];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-panel border px-4 py-3", surface)}>
      <Icon aria-hidden className={cn("size-4 shrink-0", iconTone)} />
      <div className="flex min-w-0 flex-1 flex-col"><p className="text-body font-medium">{title}</p>{children ? <p className="text-meta text-fg-secondary">{children}</p> : null}</div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// KPI strip: one surface, one column per figure, with a quiet caption over each group (Money, Operations). Phones
// show the figures as a 2×2 grid. Definitions live in a help tooltip beside the label, never in the number itself.

export type Kpi = { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; href?: string; tone?: "default" | "attention"; /** One-sentence definition shown in a help tooltip. */ info?: string; /** A word or phrase rather than a number: smaller type so it never needs truncating. */ text?: boolean };
export type KpiGroup = { label: string; items: Kpi[] };

function KpiCell({ label: text, value, hint, icon: Icon, href, tone, info, text: isText }: Kpi) {
  return (
    <div className={cn("relative flex min-w-0 flex-col gap-1 bg-background px-4 py-3.5 sm:px-5 sm:py-4", href && "nav-interact transition-colors hover:bg-canvas")}>
      <dt className="flex min-h-6 items-center gap-2 text-meta text-fg-secondary">
        <Icon aria-hidden className="size-4 shrink-0" />
        {href ? <Link href={href} className="min-w-0 outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand">{text}</Link> : <span className="min-w-0">{text}</span>}
        {info ? <span className="relative z-10 -ml-1.5"><InfoTip label={`What is ${text}?`}>{info}</InfoTip></span> : null}
      </dt>
      <dd className={cn("font-semibold tracking-tight tabular-nums", isText ? "text-[1.125rem] leading-7 break-words sm:min-h-8 sm:leading-8" : "text-[1.375rem] leading-8 sm:text-[1.625rem] sm:leading-9", tone === "attention" && "text-action-text")}>{value}</dd>
      {hint ? <dd className="text-label text-fg-secondary">{hint}</dd> : null}
    </div>
  );
}

export function KpiStrip({ groups, label: ariaLabel }: { groups: KpiGroup[]; label: string }) {
  const items = groups.flatMap((group) => group.items);
  const columns = { "--kpi-columns": items.length } as CSSProperties;
  return (
    <div aria-label={ariaLabel} role="group" className="overflow-hidden rounded-panel border bg-background">
      <div aria-hidden style={{ ...columns, gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} className="hidden md:grid">
        {groups.map((group) => <p key={group.label} style={{ gridColumn: `span ${group.items.length}` }} className="px-5 pt-3 text-label font-medium tracking-wide text-fg-faint uppercase">{group.label}</p>)}
      </div>
      <dl style={columns} className="grid grid-cols-2 gap-px bg-border md:[grid-template-columns:repeat(var(--kpi-columns),minmax(0,1fr))] max-md:[&>*:last-child:nth-child(odd)]:col-span-2">
        {items.map((item) => <KpiCell key={item.label} {...item} />)}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Disclosure: native <details>, so secondary forms stay out of the way without JavaScript.

export function Disclosure({ summary, hint, icon: Icon, children, className }: { summary: ReactNode; hint?: ReactNode; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <details className={cn("group/disclosure rounded-panel border bg-background", className)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 sm:px-5 text-body font-medium nav-interact transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        {Icon ? <Icon aria-hidden className="size-4 text-action transition-transform group-open/disclosure:rotate-45" /> : <ChevronRight aria-hidden className="size-4 text-fg-faint transition-transform group-open/disclosure:rotate-90" />}
        {summary}
        {hint ? <span className="text-meta font-normal text-fg-secondary">{hint}</span> : null}
      </summary>
      <div className="flex flex-col gap-4 border-t p-4 sm:p-5 sm:max-w-xl">{children}</div>
    </details>
  );
}
