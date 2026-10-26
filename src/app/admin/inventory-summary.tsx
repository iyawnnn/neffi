import Link from "next/link";
import { cn } from "@/lib/utils";
import { STATUS_LABEL_BY_KEY, type StatusKey } from "@/modules/inventory/operations-view";
import { StateBar, type StateSegment } from "./charts";
import { KIND_LABEL } from "./inventory/format";

type Kind = "dbc" | "grc" | null;
type Row = { kind: Kind; status: StatusKey; count: number };

// The owner's inventory vocabulary, in the order a card moves through it. These come from the same mapping the
// inventory queue, the global search and the dashboard use, so every screen agrees.
const SEGMENTS = [
  { key: "needs_preparation", label: "Needs preparation", color: "var(--chart-3)", filter: "needs_preparation", keys: ["needs_preparation"] },
  { key: "ready", label: "Ready", color: "var(--chart-1)", filter: "ready", keys: ["ready"] },
  { key: "assigned", label: "Assigned", color: "var(--chart-2)", filter: "assigned", keys: ["assigned"] },
  { key: "delivered", label: "Delivered", color: "var(--chart-6)", filter: "delivered", keys: ["shipped", "given", "waiting_activation"] },
  { key: "delivery_unconfirmed", label: STATUS_LABEL_BY_KEY.delivery_unconfirmed, color: "var(--chart-3)", filter: "", keys: ["delivery_unconfirmed"] },
  { key: "activated", label: "Activated", color: "var(--chart-7)", filter: "activated", keys: ["activated"] },
  { key: "retired", label: "Retired", color: "var(--chart-5)", filter: "retired", keys: ["retired"] },
  { key: "available_blank", label: "Available blank", color: "var(--chart-muted)", filter: "available", keys: ["available_blank"] },
] as const;

const KINDS: Kind[] = ["dbc", "grc", null];

function segmentsFor(rows: Row[], kind: Kind): StateSegment[] {
  return SEGMENTS.map(({ key, label, color, keys }) => ({ key, label, color, value: rows.filter((row) => row.kind === kind && (keys as readonly string[]).includes(row.status)).reduce((sum, row) => sum + row.count, 0) }));
}

/** How many cards exist and where they stand. `full` adds the headline figures that link into the filtered queue. */
export function InventorySummary({ rows, full = false, className, basePath = "/admin/inventory" }: { rows: Row[]; full?: boolean; className?: string; basePath?: string }) {
  const products = KINDS.map((kind) => ({ kind, segments: segmentsFor(rows, kind) })).map((product) => ({ ...product, total: product.segments.reduce((sum, s) => sum + s.value, 0) })).filter((product) => product.total > 0);
  const total = products.reduce((sum, product) => sum + product.total, 0);
  if (!total) return <p className="text-meta text-fg-secondary">No cards yet. Receive stock to add blank cards.</p>;
  const max = Math.max(...products.map((product) => product.total));
  const totals = SEGMENTS.map((segment) => ({ ...segment, value: products.reduce((sum, product) => sum + (product.segments.find((s) => s.key === segment.key)?.value ?? 0), 0) }));

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {full ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-baseline gap-2"><span className="text-[1.75rem] leading-9 font-semibold tracking-tight tabular-nums">{total}</span><span className="text-body text-fg-secondary">{total === 1 ? "card in total" : "cards in total"}</span></p>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4 lg:grid-cols-8">
            {totals.map((segment) => (
              <Link key={segment.key} href={segment.filter ? `${basePath}?status=${segment.filter}` : basePath} className="group flex min-w-0 flex-col gap-1 bg-background px-3 py-2.5 nav-interact transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
                <dt className="flex items-center gap-1.5 text-label text-fg-secondary"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: segment.color }} />{segment.label}</dt>
                <dd className={cn("text-[1.125rem] leading-6 font-semibold tabular-nums", !segment.value && "text-fg-faint")}>{segment.value}</dd>
              </Link>
            ))}
          </dl>
        </div>
      ) : null}
      <ul className="flex flex-1 flex-col justify-between gap-5">
        {products.map((product) => (
          <li key={product.kind ?? "none"} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body font-medium">{KIND_LABEL[product.kind ?? "none"]}</span>
              <span className="text-meta text-fg-secondary tabular-nums">{product.total} {product.total === 1 ? "card" : "cards"}</span>
            </div>
            <StateBar name={KIND_LABEL[product.kind ?? "none"]} segments={product.segments} max={max} />
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {product.segments.filter((segment) => segment.value > 0).map((segment) => (
                <li key={segment.key} className="inline-flex items-center gap-1.5 text-meta text-fg-secondary"><span aria-hidden className="size-2.5 rounded-full" style={{ background: segment.color }} />{segment.label}<span className="font-medium text-foreground tabular-nums">{segment.value}</span></li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
