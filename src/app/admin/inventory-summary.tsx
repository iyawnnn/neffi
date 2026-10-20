import Link from "next/link";
import { cn } from "@/lib/utils";
import { StateBar, type StateSegment } from "./charts";
import { KIND_LABEL } from "./inventory/format";

type Kind = "dbc" | "grc" | null;
type Row = { kind: Kind; state: string; count: number };

// Card states in the order a card moves through them. "In provisioning" is not a stored state: it is the blank DBCs
// that already hold their permanent token, so it is carved out of Blank rather than added on top.
const STATES = [
  { key: "ready", label: "Ready", color: "var(--chart-1)", state: "ready" },
  { key: "in_provisioning", label: "In provisioning", color: "var(--chart-3)", state: "blank" },
  { key: "blank", label: "Blank", color: "var(--chart-muted)", state: "blank" },
  { key: "reserved", label: "Reserved", color: "var(--chart-2)", state: "reserved" },
  { key: "released", label: "Released", color: "var(--chart-6)", state: "released" },
  { key: "retired", label: "Retired", color: "var(--chart-7)", state: "retired" },
] as const;

const KINDS: Kind[] = ["dbc", "grc", null];

function segmentsFor(rows: Row[], kind: Kind, inProvisioning: number): StateSegment[] {
  const count = (state: string) => rows.filter((row) => row.kind === kind && row.state === state).reduce((sum, row) => sum + row.count, 0);
  const provisioning = kind === "dbc" ? Math.min(inProvisioning, count("blank")) : 0;
  return STATES.map(({ key, label, color }) => ({ key, label, color, value: key === "in_provisioning" ? provisioning : key === "blank" ? count("blank") - provisioning : count(key) }));
}

/**
 * How many cards exist and where they stand, from the same state counts the inventory list uses. `full` adds the
 * headline figures that link into the filtered list; the dashboard shows the compact per-product bars.
 */
export function InventorySummary({ rows, inProvisioning, full = false, className, basePath = "/admin/inventory" }: { rows: Row[]; inProvisioning: number; full?: boolean; className?: string; basePath?: string }) {
  const products = KINDS.map((kind) => ({ kind, segments: segmentsFor(rows, kind, inProvisioning) })).map((product) => ({ ...product, total: product.segments.reduce((sum, s) => sum + s.value, 0) })).filter((product) => product.total > 0);
  const total = products.reduce((sum, product) => sum + product.total, 0);
  if (!total) return <p className="text-meta text-fg-secondary">No cards yet. Receive stock to add blank cards.</p>;
  const max = Math.max(...products.map((product) => product.total));
  const totals = STATES.map((state) => ({ ...state, value: products.reduce((sum, product) => sum + (product.segments.find((s) => s.key === state.key)?.value ?? 0), 0) }));

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {full ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-baseline gap-2"><span className="text-[1.75rem] leading-9 font-semibold tracking-tight tabular-nums">{total}</span><span className="text-body text-fg-secondary">{total === 1 ? "card in total" : "cards in total"}</span></p>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 lg:grid-cols-6">
            {totals.map((state) => (
              <Link key={state.key} href={`${basePath}?state=${state.state}`} className="group flex min-w-0 flex-col gap-1 bg-background px-3 py-2.5 nav-interact transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
                <dt className="flex items-center gap-1.5 text-label text-fg-secondary"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: state.color }} />{state.label}</dt>
                <dd className={cn("text-[1.125rem] leading-6 font-semibold tabular-nums", !state.value && "text-fg-faint")}>{state.value}</dd>
              </Link>
            ))}
          </dl>
        </div>
      ) : null}
      <ul className="flex flex-1 flex-col justify-between gap-5">
        {products.map((product) => (
          <li key={product.kind ?? "none"} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`${basePath}?kind=${product.kind ?? "none"}`} className="text-body font-medium hover:text-action-text focus-visible:outline-2 focus-visible:outline-brand">{KIND_LABEL[product.kind ?? "none"]}</Link>
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
