import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Hash, Receipt, Tag } from "lucide-react";
import { formatPeso } from "@/lib/money";
import type { expenseReport, ExpenseRow } from "@/modules/expenses/report";
import { expensePoints, hasData } from "../chart-data";
import { ExpenseCategoriesChart, DailySpendChart } from "../charts";
import { adminPageWide, EmptyPanel, KpiStrip, label, Meta, PageHeader, Panel, RecordTable, Section, TextLink } from "../ui";

function shiftMonth(month: string, by: number) {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

type Props = {
  month: string; monthLabel: string; report: Awaited<ReturnType<typeof expenseReport>>;
  actions?: ReactNode; renderEdit?: (row: ExpenseRow) => ReactNode;
  basePath?: string; href?: (path: string) => string;
};

export function ExpensesView({ month, monthLabel, report, actions, renderEdit, basePath = "/admin/expenses", href = (path) => path }: Props) {
  const categories = Object.entries(report.categories).map(([key, amount]) => ({ key, label: label(key), amount })).filter((row) => row.amount > 0).sort((a, b) => b.amount - a.amount);
  const top = categories[0];
  const slices = categories;
  const points = expensePoints(month, report.rows);
  const step = "inline-flex size-11 items-center justify-center rounded-lg border bg-background text-fg-secondary nav-interact transition-colors hover:border-border-strong hover:bg-canvas hover:text-foreground active:bg-subtle focus-visible:outline-2 focus-visible:outline-brand md:size-9";
  const peak = points.reduce((best, point) => (point.amount > best.amount ? point : best), points[0]);

  return <main data-admin-section="expenses" className={adminPageWide}>
    <PageHeader
      title="Expenses"
      description="Manual expenses plus courier and stock costs recorded elsewhere."
      actions={<>
        <nav aria-label="Month" className="flex items-center justify-between gap-2 max-sm:basis-full">
          <Link href={`${basePath}?month=${shiftMonth(month, -1)}`} aria-label="Previous month" className={step}><ChevronLeft aria-hidden className="size-4" /></Link>
          <span className="min-w-32 text-center text-body font-medium tabular-nums" aria-current="date">{monthLabel}</span>
          <Link href={`${basePath}?month=${shiftMonth(month, 1)}`} aria-label="Next month" className={step}><ChevronRight aria-hidden className="size-4" /></Link>
        </nav>
        {actions}
      </>}
    />

    <KpiStrip
      label={`Expense totals for ${monthLabel}`}
      groups={[{
        label: monthLabel,
        items: [
          { label: "Total spent", value: formatPeso(report.total), hint: "Manual, courier and stock", icon: Receipt },
          { label: "Entries", value: report.rows.length, hint: report.rows.length === 1 ? "expense recorded" : "expenses recorded", icon: Hash },
          { label: "Top category", value: top ? top.label : "None yet", hint: top ? `${formatPeso(top.amount)} · ${Math.round((top.amount / report.total) * 100)}% of spending` : "Nothing recorded this month", icon: Tag, text: true },
        ],
      }]}
    />

    <Section title="Spending" description={`Recorded by day and by category in ${monthLabel}.`}>
      {hasData(points, ["amount"]) ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
          <Panel padded className="flex flex-col gap-4">
            <h3 className="text-section">By day</h3>
            <DailySpendChart points={points} summary={`${monthLabel}: ${formatPeso(report.total)} spent across ${report.rows.length} ${report.rows.length === 1 ? "entry" : "entries"}. Highest day ${peak.long}, ${formatPeso(peak.amount)}.`} />
          </Panel>
          <Panel padded className="flex flex-col gap-4">
            <h3 className="text-section">By category</h3>
            <ExpenseCategoriesChart slices={slices} summary={`${monthLabel} spending by category, largest first: ${slices.map((row) => `${row.label} ${formatPeso(row.amount)}`).join(", ")}.`} />
          </Panel>
        </div>
      ) : (
        <EmptyPanel icon={Receipt} title="Not enough data to chart this period">Expenses recorded in {monthLabel} will be charted here.</EmptyPanel>
      )}
    </Section>

    <Section title="Entries">
      {report.rows.length ? (
        <RecordTable
          caption={`Expenses in ${monthLabel}`}
          rows={report.rows}
          rowKey={(row) => `${row.source}-${row.id}`}
          href={(row) => (row.source === "manual" ? undefined : row.source === "courier" ? href(`/admin/orders/${row.orderId}`) : href(`/admin/inventory/stock/${row.id}`))}
          columns={[
            { label: "Date", cell: (row) => <span className="text-meta whitespace-nowrap text-fg-secondary tabular-nums">{row.spentOn}</span> },
            { label: "Details", cell: (row) => <><span className="font-medium">{label(row.category)}</span>{row.payee || row.note ? <Meta>{[row.payee, row.note].filter(Boolean).join(" · ")}</Meta> : null}{row.source !== "manual" ? <Meta>Recorded from {row.source === "courier" ? "a shipment" : "a stock purchase"}</Meta> : null}</> },
            { label: "Amount", align: "right", cell: (row) => <span className="font-medium">{formatPeso(row.amount)}</span> },
            { label: "Actions", align: "right", cell: (row) => (row.source === "manual" ? renderEdit?.(row) : <TextLink href={row.source === "courier" ? href(`/admin/orders/${row.orderId}`) : href(`/admin/inventory/stock/${row.id}`)} className="justify-end">{`View source (${row.source})`}</TextLink>) },
          ]}
          mobile={(row) => ({
            title: label(row.category),
            subtitle: [row.payee, row.note].filter(Boolean).join(" · ") || (row.source !== "manual" ? `Recorded from ${row.source === "courier" ? "a shipment" : "a stock purchase"}` : undefined),
            figures: [["Amount", formatPeso(row.amount)]],
            meta: row.spentOn,
            cta: "View source",
            action: row.source === "manual" ? renderEdit?.(row) : undefined,
          })}
        />
      ) : (
        <EmptyPanel icon={Receipt} title="No expenses this month">Add one with the button above, or record courier and stock costs from orders and inventory.</EmptyPanel>
      )}
    </Section>
  </main>;
}
