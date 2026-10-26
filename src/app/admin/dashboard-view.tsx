import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Activity, ArrowRight, ChartNoAxesCombined, CircleCheck, ClipboardList, HandCoins, LifeBuoy, PackageCheck, PackagePlus, Plus, Receipt, Wallet } from "lucide-react";
import type { dashboard } from "@/modules/orders/dashboard";
import type { listOrders } from "@/modules/orders/queries";
import type { monthTrends } from "@/modules/orders/trends";
import type { expenseReport } from "@/modules/expenses/report";
import type { listCases } from "@/modules/support/queries";
import { formatPeso } from "@/lib/money";
import { formatDateTime } from "@/lib/format-date";
import { cashFlowPoints, hasData, orderPoints } from "./chart-data";
import { CashFlowChart, OrdersChart } from "./charts";
import { InventorySummary } from "./inventory-summary";
import { InfoTip } from "./info-tip";
import { OrdersTable } from "./orders/orders-table";
import { adminPageWide, caseTone, EmptyState, KpiStrip, label, LinkButton, Meta, PageHeader, Panel, Section, Status, TextLink } from "./ui";

const internalNote = /^[a-z]+(_[a-z]+)+ [0-9a-f]{8}-/;

type Props = {
  month: string; monthLabel: string;
  data: Awaited<ReturnType<typeof dashboard>>;
  report: Awaited<ReturnType<typeof expenseReport>>;
  trends: Awaited<ReturnType<typeof monthTrends>>;
  recentOrders: Awaited<ReturnType<typeof listOrders>>;
  openCases: Awaited<ReturnType<typeof listCases>>;
  actions?: ReactNode; basePath?: string;
};

export function DashboardView({ month, monthLabel, data, report, trends, recentOrders, openCases, actions, basePath = "/admin" }: Props) {
  const href = (path: string) => path.replace(/^\/admin(?=\/|\?|$)/, basePath);
  const cash = cashFlowPoints(month, trends.collected, report.rows);
  const orders = orderPoints(month, trends.orders);
  const orderTotals = { in_progress: 0, completed: 0, cancelled: 0 };
  for (const point of orders) { orderTotals.in_progress += point.in_progress; orderTotals.completed += point.completed; orderTotals.cancelled += point.cancelled; }
  const ordersThisMonth = orderTotals.in_progress + orderTotals.completed + orderTotals.cancelled;
  // Cash received minus costs recorded: a cash-flow indicator, deliberately not called income or profit.
  const surplus = data.collected - data.expenses;

  // Only things an owner can act on. Each row opens the list already filtered to it.
  const attention = [
    { label: "Open support cases", value: data.openSupportCases, href: href("/admin/support?status=open"), icon: LifeBuoy },
    { label: "Orders in progress", value: data.inProgress, href: href("/admin/orders?status=in_progress"), icon: ClipboardList },
    { label: "Cards needing preparation", value: data.stock.status.filter((row) => row.status === "needs_preparation").reduce((sum, row) => sum + row.count, 0), href: href("/admin/inventory?status=needs_preparation"), icon: PackageCheck },
  ].filter((item) => item.value > 0);

  return (
    <main data-admin-section="dashboard" className={adminPageWide}>
      <PageHeader
        title="Dashboard"
        description="Orders, inventory, customers and support at a glance."
        actionsLabel="Quick actions"
        actions={actions ?? (
          <>
            <LinkButton href={href("/admin/orders/new")} variant="action" icon={Plus} className="max-sm:basis-full!">New Order</LinkButton>
            <LinkButton href={href("/admin/inventory")} icon={PackagePlus}>Add Stock</LinkButton>
            <LinkButton href={href("/admin/expenses?add=1")} icon={Receipt}>Add Expense</LinkButton>
            <LinkButton href={href("/admin/support/new")} icon={LifeBuoy}>Open Support Case</LinkButton>
          </>
        )}
      />

      <KpiStrip
        label={`Key figures for ${monthLabel}`}
        groups={[
          {
            label: "Money",
            items: [
              { label: "Collected", value: formatPeso(data.collected), hint: "Received this month", icon: Wallet, info: "Payments actually received this month, net of refunds." },
              { label: "Outstanding", value: formatPeso(data.outstanding), hint: "Still due from customers", icon: HandCoins, href: href("/admin/orders?status=in_progress"), info: "Amount still due from customer orders." },
              { label: "Expenses", value: formatPeso(data.expenses), hint: "Recorded this month", icon: Receipt, href: href("/admin/expenses"), info: "Costs recorded this month: manual expenses, courier costs and stock purchases." },
            ],
          },
          {
            label: "Operations",
            items: [
              { label: "Orders in progress", value: data.inProgress, hint: data.inProgress === 1 ? "Needs fulfillment" : "Need fulfillment", icon: ClipboardList, href: href("/admin/orders?status=in_progress") },
            ],
          },
        ]}
      />

      {/* Vertical flow. Full-width panels never leave blank space beside them, and the one side-by-side row pairs two
          panels of similar height that stretch to match. */}
      <Section title="Needs attention">
        <Panel>
          {attention.length ? (
            <ul style={{ "--attention-columns": attention.length } as CSSProperties} className="grid divide-y sm:[grid-template-columns:repeat(var(--attention-columns),minmax(0,1fr))] sm:divide-x sm:divide-y-0">
              {attention.map(({ label: text, value, href, icon: Icon }) => (
                <li key={text}>
                  <Link href={href} className="group flex min-h-14 items-center gap-3 px-4 py-3 nav-interact transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-5">
                    <Icon aria-hidden className="size-4 shrink-0 text-fg-secondary" />
                    <span className="min-w-0 flex-1 text-body font-medium">{text}</span>
                    <span className="text-body font-semibold tabular-nums">{value}</span>
                    <ArrowRight aria-hidden className="size-3.5 nav-interact nav-arrow" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-3 px-4 py-4 text-body sm:px-5"><CircleCheck aria-hidden className="size-4 shrink-0 text-fg-secondary" /><span className="font-medium">Nothing needs attention</span><span className="text-fg-secondary max-sm:hidden">No open cases, orders in progress or cards waiting on provisioning.</span></p>
          )}
          {openCases.cases.length ? (
            <ul aria-label="Latest open support cases" className="flex flex-col divide-y border-t bg-canvas/60">
              {openCases.cases.slice(0, 3).map((row) => (
                <li key={row.id} className="relative flex flex-col gap-1 px-4 py-3 nav-interact transition-colors hover:bg-canvas sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
                  <Link href={href(`/admin/support/${row.id}`)} className="line-clamp-1 min-w-0 text-body font-medium outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand">{row.summary}</Link>
                  <span className="flex shrink-0 flex-wrap items-center gap-x-4 text-meta text-fg-secondary"><Status tone={caseTone(row.status)}>{label(row.status)}</Status><span className="tabular-nums">{formatDateTime(row.createdAt)}</span></span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </Section>

      <Section title="Cash flow" description={`Money received and spent, by day in ${monthLabel}.`} actions={<TextLink href={href("/admin/expenses")}>Open expenses</TextLink>}>
        <Panel padded className="flex flex-col gap-5">
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <div className="flex flex-col gap-0.5"><dt className="flex items-center gap-1.5 text-meta text-fg-secondary"><span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: "var(--chart-1)" }} />Collected<span className="-ml-0.5"><InfoTip label="What is Collected?">Payments actually received this month, net of refunds.</InfoTip></span></dt><dd className="text-section tabular-nums">{formatPeso(data.collected)}</dd></div>
            <div className="flex flex-col gap-0.5"><dt className="flex items-center gap-1.5 text-meta text-fg-secondary"><span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: "var(--chart-2)" }} />Expenses<span className="-ml-0.5"><InfoTip label="What are Expenses?">Costs recorded this month: manual expenses, courier costs and stock purchases.</InfoTip></span></dt><dd className="text-section tabular-nums">{formatPeso(data.expenses)}</dd></div>
            <div className="flex flex-col gap-0.5"><dt className="flex items-center gap-1.5 text-meta text-fg-secondary"><span aria-hidden className="w-3.5 border-t-2 border-dashed" style={{ borderColor: "var(--chart-3)" }} />Cash surplus<span className="-ml-0.5"><InfoTip label="What is Cash surplus?">Collected payments minus recorded expenses. This is a cash-flow indicator, not net income or accounting profit.</InfoTip></span></dt><dd className="text-section tabular-nums">{formatPeso(surplus)}</dd></div>
          </dl>
          {hasData(cash, ["collected", "expenses"]) ? (
            <CashFlowChart points={cash} summary={`${monthLabel}: collected ${formatPeso(data.collected)} and expenses ${formatPeso(data.expenses)}, a cash surplus of ${formatPeso(surplus)}.`} />
          ) : (
            <EmptyState icon={ChartNoAxesCombined} title="Not enough data to chart this period">Payments and expenses recorded in {monthLabel} will appear here.</EmptyState>
          )}
        </Panel>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Section className="h-full" title="Orders" description={`Created each day in ${monthLabel}, by where they stand now.`} actions={<TextLink href={href("/admin/orders")}>All orders</TextLink>}>
          <Panel padded className="flex flex-1 flex-col gap-5">
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-meta text-fg-secondary">
              <li className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full" style={{ background: "var(--chart-1)" }} />In progress <span className="font-medium text-foreground tabular-nums">{orderTotals.in_progress}</span></li>
              <li className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full" style={{ background: "var(--chart-2)" }} />Completed <span className="font-medium text-foreground tabular-nums">{orderTotals.completed}</span></li>
              <li className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full" style={{ background: "var(--chart-4)" }} />Cancelled <span className="font-medium text-foreground tabular-nums">{orderTotals.cancelled}</span></li>
            </ul>
            {ordersThisMonth ? (
              <OrdersChart points={orders} summary={`${ordersThisMonth} ${ordersThisMonth === 1 ? "order was" : "orders were"} created in ${monthLabel}: ${orderTotals.in_progress} in progress, ${orderTotals.completed} completed, ${orderTotals.cancelled} cancelled.`} />
            ) : (
              <EmptyState icon={ClipboardList} title="No orders created this month">Orders created in {monthLabel} will appear here by day.</EmptyState>
            )}
          </Panel>
        </Section>

        <Section className="h-full" title="Inventory" description="Every card by product and where it stands." actions={<TextLink href={href("/admin/inventory")}>Open inventory</TextLink>}>
          <Panel padded className="flex-1"><InventorySummary rows={data.stock.status} basePath={href("/admin/inventory")} className="h-full" /></Panel>
        </Section>
      </div>

      <Section title="Recent orders" actions={<TextLink href={href("/admin/orders")}>All orders</TextLink>}>
        {recentOrders.orders.length ? <OrdersTable orders={recentOrders.orders.slice(0, 5)} recordHref={(id) => href(`/admin/orders/${id}`)} /> : <Panel><EmptyState icon={ClipboardList} title="No orders yet" action={<LinkButton href={href("/admin/orders/new")} variant="action" icon={Plus}>New order</LinkButton>}>Orders you create will appear here.</EmptyState></Panel>}
      </Section>

      <Section title="Recent activity">
        <Panel>
          {data.recent.length ? (
            <ul className="divide-y">
              {data.recent.slice(0, 6).map((event) => (
                <li key={event.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-body font-medium">{label(event.type)}</p>
                    {event.note && !internalNote.test(event.note) ? <Meta className="line-clamp-2">{event.note}</Meta> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-x-4 gap-y-1 max-sm:flex-wrap sm:flex-col sm:items-end sm:gap-0.5">
                    <time dateTime={event.createdAt.toISOString()} className="text-meta text-fg-secondary tabular-nums">{formatDateTime(event.createdAt)}</time>
                    {event.orderId ? <TextLink href={href(`/admin/orders/${event.orderId}`)}>View order</TextLink> : event.cardId ? <TextLink href={href(`/admin/inventory/cards/${event.cardId}`)}>View card</TextLink> : event.stockPurchaseId ? <TextLink href={href(`/admin/inventory/stock/${event.stockPurchaseId}`)}>View stock</TextLink> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Activity} title="No activity yet">Orders, stock and card changes will appear here as they happen.</EmptyState>
          )}
        </Panel>
      </Section>
    </main>
  );
}
