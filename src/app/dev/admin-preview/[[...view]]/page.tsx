import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminFrame } from "@/app/admin/admin-frame";
import { DashboardView } from "@/app/admin/dashboard-view";
import { ExpensesView } from "@/app/admin/expenses/expenses-view";
import { InventoryView } from "@/app/admin/inventory/inventory-view";
import { OrdersView, type OrdersViewProps } from "@/app/admin/orders/orders-view";
import { CustomersView } from "@/app/admin/customers/customers-view";
import { SupportView, type SupportViewProps } from "@/app/admin/support/support-view";
import { SearchView } from "@/app/admin/search/search-view";
import { adminPage, PageHeader, Panel, TextLink } from "@/app/admin/ui";
import { Button } from "@/components/ui/button";
import { PreviewPalette } from "@/dev/admin/preview-palette";
import { accounts, cases, counts, dashboardData, filterQueue, filterCases, filterOrders, fixturePage, MONTH, MONTH_LABEL, orders, owners, PREVIEW_BASE, previewHitHref, previewHref, purchasers, purchases, report, searchFixtures, trends } from "@/dev/admin/fixtures";

export const metadata: Metadata = { title: "Admin preview — development only", robots: { index: false, follow: false } };
export const instant = false;

type Query = Record<string, string | string[] | undefined>;
const value = (query: Query, key: string) => typeof query[key] === "string" ? query[key] : "";
const disabled = (text: string) => <Button disabled variant="action" title="Unavailable in development preview">{text}</Button>;

export default async function AdminPreviewPage({ params, searchParams }: {
  params: Promise<{ view?: string[] }>; searchParams: Promise<Query>;
}) {
  if (process.env.NODE_ENV !== "development" || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development")) notFound();
  const [{ view = [] }, query] = await Promise.all([params, searchParams]);
  const section = view[0] ?? "dashboard";
  const basePath = `${PREVIEW_BASE}/${section}`;
  const recordHref = (id: string) => `${basePath}?record=${encodeURIComponent(id)}`;
  const q = value(query, "q").trim().slice(0, 100);
  let content;

  if (view.length > 1 || value(query, "record")) {
    content = <main className={adminPage}><PageHeader title="Preview record" description="Synthetic record only. Editing and provisioning are unavailable." /><Panel padded><p className="break-all text-body">{value(query, "record") || view.slice(1).join(" / ")}</p><TextLink href={basePath}>Back to {section}</TextLink></Panel></main>;
  } else if (section === "dashboard") {
    content = <DashboardView month={MONTH} monthLabel={MONTH_LABEL} data={dashboardData} report={report} trends={trends} recentOrders={{ orders, next: null }} openCases={{ cases: cases.filter((row) => row.status === "open"), next: null }} basePath={PREVIEW_BASE} actions={<>{disabled("New Order")}{disabled("Add Stock")}{disabled("Add Expense")}{disabled("Open Support Case")}</>} />;
  } else if (section === "inventory") {
    const status = value(query, "status"); const search = value(query, "q") || undefined;
    const filter = (["needs_preparation", "ready", "assigned", "delivered", "activated", "retired", "available"] as const).find((candidate) => candidate === status);
    const stockView = query.view === "stock";
    const page = fixturePage(filterQueue(filter, search), query.page);
    const stockPage = fixturePage(purchases, query.page);
    content = <InventoryView {...{ filter, search, stockView, counts, basePath, recordHref }} shortage={0} paging={stockView ? stockPage.window : page.window} queue={{ cards: page.rows, next: null }} purchases={stockPage.rows} actions={<>{disabled("Receive stock")}{disabled("Provision cards")}</>} />;
  } else if (section === "orders") {
    const status = value(query, "status");
    const filters: OrdersViewProps["filters"] = { status: status === "in_progress" || status === "completed" || status === "cancelled" ? status : undefined, assigneeId: value(query, "assigneeId") || undefined };
    const page = fixturePage(filterOrders(filters), query.page);
    content = <OrdersView {...{ filters, owners, basePath, recordHref }} orders={page.rows} paging={page.window} actions={disabled("New order")} />;
  } else if (section === "customers") {
    const showAccounts = query.view === "accounts";
    const accountPage = fixturePage(accounts.filter((row) => row.email.toLowerCase().includes(q.toLowerCase())), query.page);
    const purchaserPage = fixturePage(purchasers.filter((row) => `${row.name} ${row.contactNumber ?? ""}`.toLowerCase().includes(q.toLowerCase())), query.page);
    content = <CustomersView accounts={showAccounts} query={q} paging={showAccounts ? accountPage.window : purchaserPage.window} accountRows={accountPage.rows} purchaserRows={purchaserPage.rows} {...{ basePath, recordHref }} />;
  } else if (section === "support") {
    const status = value(query, "status"); const source = value(query, "source");
    const filters: SupportViewProps["filters"] = { status: status === "open" || status === "waiting_on_customer" || status === "resolved" ? status : undefined, source: source === "owner" || source === "public" || source === "account" ? source : undefined };
    const page = fixturePage(filterCases(filters), query.page);
    content = <SupportView {...{ filters, basePath, recordHref }} cases={page.rows} paging={page.window} actions={disabled("Open support case")} />;
  } else if (section === "expenses") {
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(value(query, "month")) ? value(query, "month") : MONTH;
    const monthLabel = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "long" }).format(new Date(`${month}-01T00:00:00Z`));
    content = <ExpensesView {...{ month, monthLabel, basePath }} report={month === MONTH ? report : { rows: [], categories: {}, total: 0 }} href={previewHref} actions={disabled("Add expense")} renderEdit={() => <Button disabled size="sm">Edit</Button>} />;
  } else if (section === "search") {
    const page = fixturePage(searchFixtures(q), query.page);
    content = <SearchView query={q} hits={page.rows} paging={page.window} basePath={basePath} recordHref={previewHitHref} />;
  } else if (section === "settings") {
    content = <main className={adminPage}><PageHeader title="Settings" description="Settings are unavailable in this read-only preview." /></main>;
  } else notFound();

  return <AdminFrame basePath={PREVIEW_BASE} account={<p className="px-3 text-meta text-fg-secondary">Development preview<br />October 2026 · synthetic data</p>} palette={<PreviewPalette />}>
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-4 py-1 text-meta text-fg-secondary sm:px-6">
      <span>Development preview · October 2026 · changes disabled</span>
      <Link href={`${PREVIEW_BASE}/search?q=sample`} className="inline-flex min-h-11 items-center rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-brand">Search fixtures</Link>
    </div>
    {content}
  </AdminFrame>;
}
