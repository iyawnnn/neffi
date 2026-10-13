import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { getPurchaser } from "@/modules/orders/purchasers";
import { listOrders } from "@/modules/orders/queries";
import { formatPeso } from "@/lib/money";
import { inputClass } from "@/components/ui/input";
import { ActionForm } from "../../../inventory/forms";
import { updatePurchaserAction } from "../../actions";
export const instant = false;
export default async function PurchaserPage({ params, searchParams }: PageProps<"/admin/customers/purchasers/[id]">) {
  await requireOwner(); await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const purchaser = await getPurchaser(db, id);
  if (!purchaser) notFound();
  const filters = await searchParams;
  const page = await listOrders(db, { purchaserId: id, before: typeof filters.before === "string" ? filters.before : undefined });
  return <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8"><Link className="underline" href="/admin/customers">Purchasers</Link><h1 className="text-2xl font-semibold">{purchaser.name}</h1>
    <Link className="flex min-h-11 items-center rounded-lg border px-4" href={`/admin/orders/new?purchaserId=${id}`}>New order for this purchaser</Link>
    <ActionForm action={updatePurchaserAction} submit="Save purchaser"><input type="hidden" name="id" value={id} /><label>Name<input className={inputClass} name="name" required maxLength={100} defaultValue={purchaser.name} /></label><label>Contact number<input className={inputClass} name="contactNumber" maxLength={50} defaultValue={purchaser.contactNumber ?? ""} /></label></ActionForm>
    <h2 className="font-semibold">Orders</h2>{page.orders.map((order) => <Link className="min-h-11 rounded-lg border p-3" key={order.id} href={`/admin/orders/${order.id}`}>Order {order.number} · {order.status.replaceAll("_", " ")} · Total {formatPeso(order.orderTotal)} · Balance {formatPeso(order.balance)}</Link>)}
    {!page.orders.length ? <p>No orders yet.</p> : null}{page.next ? <Link className="min-h-11 underline" href={`?before=${encodeURIComponent(page.next)}`}>Older orders</Link> : null}
  </main>;
}
