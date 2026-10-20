"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatPeso } from "@/lib/money";
import type { CashFlowPoint, CategorySlice, DayAmount, OrderPoint } from "./chart-data";

// Neffi charts on the shadcn chart primitives (Recharts underneath). Series colours come from the --chart-* tokens:
// Vermilion leads, then warm orange, coral and peach, then warm neutrals. Never black. Every chart ships a one-sentence
// summary and a screen-reader table, so no number exists only as a shape or a colour, and animation stops for people
// who ask for reduced motion.

const reducedMotion = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(reducedMotion);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
function useAnimate() {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(reducedMotion).matches, () => false);
  return { isAnimationActive: !reduced, animationDuration: 260, animationEasing: "ease-out" as const };
}

const axisTick = { fontSize: 11, fill: "var(--fg-secondary)" };
const grid = <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="var(--border)" />;

function compactPeso(centavos: number) {
  const pesos = centavos / 100;
  const abs = Math.abs(pesos);
  const text = abs >= 1000 ? `${Number((abs / 1000).toFixed(abs >= 10_000 ? 0 : 1))}k` : String(Math.round(abs));
  return `${pesos < 0 ? "-" : ""}₱${text}`;
}

function Frame({ summary, children, table }: { summary: string; children: ReactNode; table: { caption: string; head: string[]; rows: (string | number)[][] } }) {
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">{summary}</figcaption>
      {children}
      {/* The clip lives on a wrapper: a wide table inside its own sr-only box still stretches the page sideways on phones. */}
      <div className="sr-only">
        <table>
          <caption>{table.caption}</caption>
          <thead><tr>{table.head.map((name) => <th key={name} scope="col">{name}</th>)}</tr></thead>
          <tbody>{table.rows.map((row) => <tr key={String(row[0])}>{row.map((cell, index) => (index ? <td key={index}>{cell}</td> : <th key={index} scope="row">{cell}</th>))}</tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}

const mediumLabel = (_: unknown, payload: readonly { payload?: { medium?: string } }[]) => payload[0]?.payload?.medium ?? "";
const shortLabel = (_: unknown, payload: readonly { payload?: { short?: string } }[]) => payload[0]?.payload?.short ?? "";

// ---------------------------------------------------------------------------------------------------------------

const cashConfig = {
  collected: { label: "Collected", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-2)" },
  surplus: { label: "Cash surplus", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** Money in, money out and what is left of it, per day of the month. The surplus is cash flow, not profit. */
export function CashFlowChart({ points, summary }: { points: CashFlowPoint[]; summary: string }) {
  const animate = useAnimate();
  return (
    <Frame summary={summary} table={{ caption: "Collected, expenses and cash surplus by day", head: ["Day", "Collected", "Expenses", "Cash surplus"], rows: points.filter((p) => p.collected || p.expenses).map((p) => [p.long, formatPeso(p.collected), formatPeso(p.expenses), formatPeso(p.surplus)]) }}>
      <ChartContainer config={cashConfig} className="aspect-auto h-56 w-full sm:h-64">
        <AreaChart accessibilityLayer data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {grid}
          <XAxis dataKey="short" tickLine={false} axisLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={36} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} width={46} tickCount={4} tickFormatter={compactPeso} />
          <ChartTooltip cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} content={<ChartTooltipContent labelFormatter={mediumLabel} valueFormatter={(value) => formatPeso(value)} />} />
          <Area dataKey="collected" type="linear" stroke="var(--color-collected)" strokeWidth={2.25} fill="var(--color-collected)" fillOpacity={0.1} dot={false} activeDot={{ r: 4 }} {...animate} />
          <Area dataKey="expenses" type="linear" stroke="var(--color-expenses)" strokeWidth={2} fill="var(--color-expenses)" fillOpacity={0.06} dot={false} activeDot={{ r: 3 }} {...animate} />
          <Area dataKey="surplus" type="linear" stroke="var(--color-surplus)" strokeWidth={1.75} strokeDasharray="5 4" fill="none" dot={false} activeDot={{ r: 3 }} {...animate} />
        </AreaChart>
      </ChartContainer>
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------------------------------

const ordersConfig = {
  in_progress: { label: "In progress", color: "var(--chart-1)" },
  completed: { label: "Completed", color: "var(--chart-2)" },
  cancelled: { label: "Cancelled", color: "var(--chart-4)" },
} satisfies ChartConfig;

/** Orders created each day, split by where they stand today. */
export function OrdersChart({ points, summary }: { points: OrderPoint[]; summary: string }) {
  const animate = useAnimate();
  const count = (value: number) => `${value} ${value === 1 ? "order" : "orders"}`;
  return (
    <Frame summary={summary} table={{ caption: "Orders created by day", head: ["Day", "In progress", "Completed", "Cancelled"], rows: points.filter((p) => p.in_progress || p.completed || p.cancelled).map((p) => [p.long, p.in_progress, p.completed, p.cancelled]) }}>
      <ChartContainer config={ordersConfig} className="aspect-auto h-56 w-full sm:h-60">
        <BarChart accessibilityLayer data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%" maxBarSize={18}>
          {grid}
          <XAxis dataKey="short" tickLine={false} axisLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={36} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} width={28} allowDecimals={false} tickCount={4} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideZero labelFormatter={mediumLabel} valueFormatter={count} />} />
          <Bar dataKey="cancelled" stackId="orders" fill="var(--color-cancelled)" {...animate} />
          <Bar dataKey="completed" stackId="orders" fill="var(--color-completed)" {...animate} />
          <Bar dataKey="in_progress" stackId="orders" fill="var(--color-in_progress)" radius={[3, 3, 0, 0]} {...animate} />
        </BarChart>
      </ChartContainer>
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------------------------------

const spendConfig = { amount: { label: "Expenses", color: "var(--chart-1)" } } satisfies ChartConfig;

/** One bar per day of recorded spending. */
export function DailySpendChart({ points, summary }: { points: DayAmount[]; summary: string }) {
  const animate = useAnimate();
  return (
    <Frame summary={summary} table={{ caption: "Expenses by day", head: ["Day", "Amount"], rows: points.filter((p) => p.amount).map((p) => [p.long, formatPeso(p.amount)]) }}>
      <ChartContainer config={spendConfig} className="aspect-auto h-52 w-full sm:h-60">
        <BarChart accessibilityLayer data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%" maxBarSize={18}>
          {grid}
          <XAxis dataKey="short" tickLine={false} axisLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={36} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} width={46} tickCount={4} tickFormatter={compactPeso} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={shortLabel} valueFormatter={(value) => formatPeso(value)} />} />
          <Bar dataKey="amount" fill="var(--color-amount)" radius={[3, 3, 0, 0]} {...animate} />
        </BarChart>
      </ChartContainer>
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------------------------------

// Rank order: Vermilion for the largest category, then orange, coral, peach and warm neutrals. The folded-up "Other"
// slice is always the quietest neutral.
const sliceColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];
export const sliceColor = (index: number, key: string) => (key === "grouped_other" ? "var(--chart-muted)" : sliceColors[index] ?? "var(--chart-6)");

/** Spending by category, ranked for direct amount comparison instead of a less readable donut. */
export function ExpenseCategoriesChart({ slices, summary }: { slices: CategorySlice[]; summary: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
  const share = (amount: number) => total ? Math.round((amount / total) * 100) : 0;
  return (
    <Frame summary={summary} table={{ caption: "Expenses by category", head: ["Category", "Amount", "Share"], rows: slices.map((slice) => [slice.label, formatPeso(slice.amount), `${share(slice.amount)}%`]) }}>
      <ul className="flex flex-col gap-4" aria-label="Expense category distribution">
        {slices.map((slice, index) => (
          <li key={slice.key}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 break-words text-body font-medium">{slice.label}</span>
              <span className="shrink-0 text-body font-medium tabular-nums">{formatPeso(slice.amount)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <span aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-subtle">
                <span className="block h-full rounded-full" style={{ width: `${share(slice.amount)}%`, background: sliceColor(index, slice.key) }} />
              </span>
              <span className="w-9 shrink-0 text-right text-meta text-fg-secondary tabular-nums">{share(slice.amount)}%</span>
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export type StateSegment = { key: string; label: string; value: number; color: string };

/**
 * One horizontal stacked bar for a product, split by card state. `max` keeps products on a shared scale. No tooltip:
 * the legend under each bar already names and counts every state, so hovering adds nothing.
 */
export function StateBar({ name, segments, max }: { name: string; segments: StateSegment[]; max: number }) {
  const animate = useAnimate();
  const config = Object.fromEntries(segments.map((segment) => [segment.key, { label: segment.label, color: segment.color }])) satisfies ChartConfig;
  const data = [{ name, ...Object.fromEntries(segments.map((segment) => [segment.key, segment.value])) }];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div role="img" aria-label={`${name}: ${total} ${total === 1 ? "card" : "cards"}. ${segments.filter((s) => s.value).map((s) => `${s.value} ${s.label}`).join(", ")}.`}>
      <ChartContainer config={config} className="aspect-auto h-6 w-full overflow-hidden rounded-md bg-subtle ring-1 ring-border ring-inset [&_*]:outline-none">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
          <XAxis type="number" hide domain={[0, max]} />
          <YAxis type="category" dataKey="name" hide />
          {segments.map((segment) => <Bar key={segment.key} dataKey={segment.key} stackId="cards" fill={`var(--color-${segment.key})`} activeBar={false} {...animate} />)}
        </BarChart>
      </ChartContainer>
    </div>
  );
}
