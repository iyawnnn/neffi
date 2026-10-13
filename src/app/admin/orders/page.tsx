import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { inputClass } from "@/components/ui/input";
import { db } from "@/db";
import { formatPeso } from "@/lib/money";
import { listOrders, orderAssignees } from "@/modules/orders/queries";

export const instant = false;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireOwner();
  await connection();
  const params = await searchParams;
  const status = z.enum(["in_progress", "completed", "cancelled"]).safeParse(params.status);
  const assignee = z.uuid().safeParse(params.assigneeId);
  const filters = { before: typeof params.before === "string" ? params.before : undefined, status: status.success ? status.data : undefined, assigneeId: assignee.success ? assignee.data : undefined };
  const [page, owners] = await Promise.all([listOrders(db, filters), orderAssignees(db)]);
  const next = new URLSearchParams();
  if (page.next) next.set("before", page.next);
  if (filters.status) next.set("status", filters.status);
  if (filters.assigneeId) next.set("assigneeId", filters.assigneeId);
  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Orders</h1><Link className="flex min-h-11 items-center rounded-lg bg-primary px-4 text-primary-foreground" href="/admin/orders/new">New order</Link></div>
    <form className="grid gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm">Status<select className={inputClass} name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      <label className="flex flex-col gap-1 text-sm">Assigned to<select className={inputClass} name="assigneeId" defaultValue={filters.assigneeId ?? ""}><option value="">All owners</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.email}</option>)}</select></label>
      <button className="min-h-11 self-end rounded-lg border px-4">Filter orders</button>
    </form>
    <div>{page.orders.map((order) => <Link key={order.id} href={`/admin/orders/${order.id}`} className="flex min-h-11 flex-wrap justify-between gap-3 border-b py-4"><div><p className="font-medium">Order {order.number} · {order.purchaserName}</p><p className="text-sm text-muted-foreground">{order.status.replaceAll("_", " ")}</p></div><div className="text-right tabular-nums"><p>{formatPeso(order.orderTotal)}</p><p className="text-sm">Balance {formatPeso(order.balance)}</p></div></Link>)}
      {!page.orders.length ? <p>No orders match these filters.</p> : null}
    </div>
    {page.next ? <Link className="flex min-h-11 items-center underline" href={`/admin/orders?${next}`}>Older orders</Link> : null}
  </main>;
}
