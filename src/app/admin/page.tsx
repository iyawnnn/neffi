import Link from "next/link";
import { connection } from "next/server";
import { requireOwner } from "@/auth/access";
import { signOutAction } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { dashboard } from "@/modules/orders/dashboard";
import { formatPeso } from "@/lib/money";
import { formatDateTime } from "@/lib/format-date";

export const instant = false;

export default async function AdminHome() {
  const viewer = await requireOwner();
  await connection();
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).format(new Date());
  const data = await dashboard(db, month);
  return (
    <main data-admin-section="dashboard" className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="break-all text-sm text-muted-foreground">Owner area · {viewer.email}</p>
      <Link href="/admin/inventory" className="text-sm underline">
        Inventory
      </Link>
      <p className="text-sm">{month}</p>
      <div className="grid gap-3 sm:grid-cols-2">{[["Open support cases", data.openSupportCases], ["In Progress orders", data.inProgress], ["Outstanding", formatPeso(data.outstanding)], ["Collected this month", formatPeso(data.collected)], ["Expenses this month", formatPeso(data.expenses)]].map(([label, value]) => <section key={label} className="rounded-lg border p-4"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="text-2xl font-semibold tabular-nums">{value}</p></section>)}</div>
      <nav aria-label="Quick actions" className="flex flex-wrap gap-3">{[["New Order", "/admin/orders/new"], ["Add Stock", "/admin/inventory"], ["Add Expense", "/admin/expenses#add"], ["Open Support Case", "/admin/support/new"]].map(([label, href]) => <Link key={href} href={href} className="flex min-h-11 items-center rounded-lg border px-4">{label}</Link>)}</nav>
      <section><h2 className="font-semibold">Stock</h2><ul className="grid gap-2 sm:grid-cols-3">{data.stock.rows.map((row) => <li key={`${row.kind}-${row.state}`}>{row.kind?.toUpperCase() ?? "Unassigned"} · {row.state}: {row.count}</li>)}</ul><p>In provisioning: {data.stock.inProvisioning}</p></section>
      <section><h2 className="font-semibold">Recent activity</h2><ul>{data.recent.map((event) => <li key={event.id} className="border-b py-3"><p>{event.type.replaceAll("_", " ")} · {formatDateTime(event.createdAt)}</p><p className="break-words text-sm">{event.note}</p>{event.orderId ? <Link className="min-h-11 underline" href={`/admin/orders/${event.orderId}`}>View order</Link> : event.cardId ? <Link className="underline" href={`/admin/inventory/cards/${event.cardId}`}>View card</Link> : event.stockPurchaseId ? <Link className="underline" href={`/admin/inventory/stock/${event.stockPurchaseId}`}>View stock purchase</Link> : null}</li>)}</ul></section>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="touch">
          Sign out
        </Button>
      </form>
    </main>
  );
}
