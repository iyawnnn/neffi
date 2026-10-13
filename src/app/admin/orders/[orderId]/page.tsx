import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { Input, Textarea, inputClass } from "@/components/ui/input";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format-date";
import { formatPeso } from "@/lib/money";
import { getOrderDetail } from "@/modules/orders/queries";
import { effectiveItemTotal } from "@/modules/orders/totals";
import { ActionForm } from "../../inventory/forms";
import { addOrderNoteAction, assignOrderAction, updateOrderDetailsAction } from "./actions";

export const instant = false;

export default async function OrderPage({ params }: Pick<PageProps<"/admin/orders/[orderId]">, "params">) {
  await requireOwner();
  await connection();
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  const order = await getOrderDetail(db, orderId);
  if (!order) notFound();
  const hidden = <input type="hidden" name="orderId" value={order.id} />;
  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 sm:p-8">
    <header className="space-y-2"><Link className="inline-flex min-h-11 items-center underline" href="/admin/orders">Orders</Link><h1 className="text-2xl font-semibold">Order {order.number}</h1><p>{order.status.replaceAll("_", " ")} · {order.totals.paymentState}</p><Link className="underline" href={`/admin/customers/purchasers/${order.purchaserId}`}>{order.purchaser.name}</Link>{order.purchaser.contactNumber ? <p>{order.purchaser.contactNumber}</p> : null}</header>
    <dl className="grid grid-cols-2 gap-4 tabular-nums sm:grid-cols-4">{[["Order total", order.totals.orderTotal], ["Net paid", order.totals.netPaid], ["Balance", order.totals.balance], ["Refund due", order.totals.refundDue]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-lg font-semibold">{formatPeso(value as number)}</dd></div>)}</dl>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Items &amp; fulfillment</h2>
      {order.items.map((item) => <div key={item.id} className="space-y-2 border-b pb-4"><h3 className="font-medium">{item.name}{item.label ? ` · ${item.label}` : ""}</h3><p className="tabular-nums">{item.quantity} × {formatPeso(item.unitPrice)} · Total {formatPeso(effectiveItemTotal(item))}</p>{item.agreedTotal !== null ? <p className="text-sm">Adjustment: {formatPeso(item.quantity * item.unitPrice - item.agreedTotal)}</p> : null}<p className="text-sm">{item.activeCount} reserved or released · {item.releasedCount} released</p>{item.reviewUrl ? <a className="block break-all underline" href={item.reviewUrl}>{item.reviewUrl}</a> : null}</div>)}
      {order.cards.map((card) => <Link className="flex min-h-11 items-center gap-3 underline" key={card.id} href={`/admin/inventory/cards/${card.id}`}>{card.kind?.toUpperCase()} {card.suffix ?? card.id.slice(-4)} · {card.state}</Link>)}
    </section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Payments &amp; refunds</h2>
      {order.payments.map((payment) => <div key={payment.id} className={payment.voidedAt ? "text-muted-foreground" : ""}><p className={payment.voidedAt ? "line-through" : ""}>Payment {formatPeso(payment.amount)} · {payment.method} · {payment.paidOn}</p>{payment.voidedAt ? <p className="text-sm">Voided: {payment.voidReason}</p> : null}</div>)}
      {order.refunds.map((refund) => <div key={refund.id}><p className={refund.voidedAt ? "line-through text-muted-foreground" : ""}>Refund {formatPeso(refund.amount)} · {refund.method} · {refund.refundedOn}</p>{refund.voidedAt ? <p className="text-sm">Voided: {refund.voidReason}</p> : null}</div>)}
      {!order.payments.length && !order.refunds.length ? <p>No money recorded.</p> : null}
    </section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Delivery</h2><p>{order.deliveryMethod?.replaceAll("_", " ") ?? "Not selected"} · Fee {formatPeso(order.shippingFee)}</p>{order.shipments.map((shipment) => <div key={shipment.id}><p>{shipment.status} · {shipment.courier} · {shipment.trackingNumber}</p><p>{shipment.shippedOn} {shipment.courierCost !== null ? `· Cost ${formatPeso(shipment.courierCost)}` : ""}</p></div>)}</section>
    {order.status === "in_progress" ? <section className="space-y-3"><h2 className="text-xl font-semibold">Order details</h2><ActionForm action={updateOrderDetailsAction} submit="Save order details">{hidden}
      <label className="flex flex-col gap-1 text-sm">Delivery method<select name="deliveryMethod" className={inputClass} defaultValue={order.deliveryMethod ?? "pickup"} disabled={order.anyReleased}><option value="pickup">Pickup</option><option value="local_handoff">Local handoff</option><option value="courier">Courier</option></select></label>
      {order.anyReleased ? <input type="hidden" name="deliveryMethod" value={order.deliveryMethod ?? ""} /> : null}
      <label className="flex flex-col gap-1 text-sm">Shipping fee (pesos, blank for zero)<Input name="shippingFee" inputMode="decimal" maxLength={30} defaultValue={order.shippingFee ? (order.shippingFee / 100).toFixed(2) : ""} /></label>
      <label className="flex flex-col gap-1 text-sm">Notes<Textarea name="notes" maxLength={500} defaultValue={order.notes ?? ""} /></label>
    </ActionForm></section> : order.notes ? <p>{order.notes}</p> : null}
    <section className="space-y-3"><h2 className="text-xl font-semibold">Assigned to</h2><ActionForm action={assignOrderAction} submit="Assign order">{hidden}<label className="flex flex-col gap-1 text-sm">Owner<select name="assignedToAccountId" className={inputClass} defaultValue={order.assignedToAccountId}>{order.assignees.map((owner) => <option key={owner.id} value={owner.id}>{owner.email}</option>)}</select></label></ActionForm><p className="text-sm text-muted-foreground">Last updated by {order.assignees.find((owner) => owner.id === order.updatedByAccountId)?.email ?? "Unknown account"} · {formatDateTime(order.updatedAt)}</p></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Internal note</h2><ActionForm action={addOrderNoteAction} submit="Add note">{hidden}<label className="flex flex-col gap-1 text-sm">Note<Textarea name="note" required maxLength={500} /></label></ActionForm></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Activity</h2>{order.timeline.map((event) => <div key={event.id} className="border-b py-3"><p>{event.type.replaceAll("_", " ")}</p>{event.note ? <p className="text-sm">{event.note}</p> : null}<p className="text-sm text-muted-foreground">{formatDateTime(event.createdAt)}</p></div>)}{!order.timeline.length ? <p>No activity yet.</p> : null}</section>
  </main>;
}
