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
import { addOrderNoteAction, assignOrderAction, updateOrderDetailsAction, addOrderItemAction, updateOrderItemAction, removeOrderItemAction } from "./actions";
import { recordPaymentAction, recordRefundAction, voidPaymentAction, voidRefundAction } from "./actions";
import { ActionSheet } from "./action-sheet";
import { MoneyFields } from "./money-fields";

export const instant = false;

export default async function OrderPage({ params }: Pick<PageProps<"/admin/orders/[orderId]">, "params">) {
  await requireOwner();
  await connection();
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  const order = await getOrderDetail(db, orderId);
  if (!order) notFound();
  const hidden = <input type="hidden" name="orderId" value={order.id} />;
  const correction = (kind: "payment" | "refund", rowId: string) => <ActionSheet title={`Void ${kind}`}><ActionForm action={kind === "payment" ? voidPaymentAction : voidRefundAction} submit={`Void ${kind}`} variant="destructive">{hidden}<input type="hidden" name={kind === "payment" ? "paymentId" : "refundId"} value={rowId} /><p className="text-sm">The original entry is kept. A void is final and excludes it from totals.</p><label className="flex flex-col gap-1 text-sm">Reason<Input name="reason" required maxLength={200} /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input name="confirm" type="checkbox" required />Confirm this correction.</label></ActionForm></ActionSheet>;
  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 sm:p-8">
    <header className="space-y-2"><Link className="inline-flex min-h-11 items-center underline" href="/admin/orders">Orders</Link><h1 className="text-2xl font-semibold">Order {order.number}</h1><p>{order.status.replaceAll("_", " ")} · {order.totals.paymentState}</p><Link className="underline" href={`/admin/customers/purchasers/${order.purchaserId}`}>{order.purchaser.name}</Link>{order.purchaser.contactNumber ? <p>{order.purchaser.contactNumber}</p> : null}</header>
    <dl className="grid grid-cols-2 gap-4 tabular-nums sm:grid-cols-4">{[["Order total", order.totals.orderTotal], ["Net paid", order.totals.netPaid], ["Balance", order.totals.balance], ["Refund due", order.totals.refundDue]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-lg font-semibold">{formatPeso(value as number)}</dd></div>)}</dl>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Items &amp; fulfillment</h2>
      {order.items.map((item) => <div key={item.id} className="space-y-2 border-b pb-4"><h3 className="font-medium">{item.name}{item.label ? ` · ${item.label}` : ""}</h3><p className="tabular-nums">{item.quantity} × {formatPeso(item.unitPrice)} · Total {formatPeso(effectiveItemTotal(item))}</p>{item.agreedTotal !== null ? <p className="text-sm">Adjustment: {formatPeso(item.quantity * item.unitPrice - item.agreedTotal)}</p> : null}{item.productKind === "dbc" ? <p className="text-sm">{item.activeCount} reserved or released · {item.releasedCount} released</p> : <p className="text-sm text-muted-foreground">Manual programming · Commercial delivery {order.hasCommercialDelivery ? "recorded" : "pending"}</p>}{item.reviewUrl ? <a className="block break-all underline" href={item.reviewUrl}>{item.reviewUrl}</a> : null}</div>)}
      {order.cards.map((card) => <Link className="flex min-h-11 items-center gap-3 underline" key={card.id} href={`/admin/inventory/cards/${card.id}`}>{card.kind?.toUpperCase()} {card.suffix ?? card.id.slice(-4)} · {card.state}</Link>)}
      {order.status === "in_progress" ? <div className="space-y-4">
        {order.items.map((item) => <details key={item.id} className="border-b pb-4"><summary className="min-h-11 cursor-pointer py-3">Edit {item.name}{item.label ? ` · ${item.label}` : ""}</summary>
          <ActionForm action={updateOrderItemAction} submit="Save item">{hidden}<input type="hidden" name="orderItemId" value={item.id} />
            <label className="flex flex-col gap-1 text-sm">Quantity<Input name="quantity" type="number" inputMode="numeric" min={1} max={500} required defaultValue={item.quantity} readOnly={item.productKind === "grc" && order.hasCommercialDelivery} /></label>
            <label className="flex flex-col gap-1 text-sm">Agreed line total (pesos, blank for catalog total)<Input name="agreedTotal" inputMode="decimal" maxLength={30} defaultValue={item.agreedTotal !== null ? (item.agreedTotal / 100).toFixed(2) : ""} /></label>
            {item.productKind === "grc" ? <><label className="flex flex-col gap-1 text-sm">Branch label (optional)<Input name="label" maxLength={100} defaultValue={item.label ?? ""} /></label><label className="flex flex-col gap-1 text-sm">Direct review URL (optional)<Input name="reviewUrl" type="url" maxLength={2048} defaultValue={item.reviewUrl ?? ""} /></label></> : null}
          </ActionForm>
          {order.items.length > 1 && !(item.productKind === "grc" && order.hasCommercialDelivery) ? <div className="mt-4"><ActionForm action={removeOrderItemAction} submit="Remove item" variant="destructive">{hidden}<input type="hidden" name="orderItemId" value={item.id} /><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" required />Remove this line from the order.</label></ActionForm></div> : null}
        </details>)}
        {(["dbc", "grc"] as const).filter((kind) => kind === "dbc" || !order.hasCommercialDelivery).map((kind) => <details key={kind}><summary className="min-h-11 cursor-pointer py-3">Add {kind.toUpperCase()} line</summary><ActionForm action={addOrderItemAction} submit="Add item">{hidden}<input type="hidden" name="kind" value={kind} />
          <label className="flex flex-col gap-1 text-sm">Quantity<Input name="quantity" type="number" inputMode="numeric" min={1} max={500} defaultValue={1} required /></label>
          <label className="flex flex-col gap-1 text-sm">Agreed line total (pesos, optional)<Input name="agreedTotal" inputMode="decimal" maxLength={30} /></label>
          {kind === "grc" ? <><label className="flex flex-col gap-1 text-sm">Branch label (optional)<Input name="label" maxLength={100} /></label><label className="flex flex-col gap-1 text-sm">Direct review URL (optional)<Input name="reviewUrl" type="url" maxLength={2048} /></label></> : null}
        </ActionForm></details>)}
      </div> : null}
    </section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Payments &amp; refunds</h2>
      {order.payments.map((payment) => <div key={payment.id} className={payment.voidedAt ? "text-muted-foreground" : ""}><p className={payment.voidedAt ? "line-through" : ""}>Payment {formatPeso(payment.amount)} · {payment.method} · {payment.paidOn}</p>{payment.reference ? <p className="text-sm">{payment.reference}</p> : null}{payment.voidedAt ? <p className="text-sm">Voided: {payment.voidReason}</p> : order.status === "in_progress" ? correction("payment", payment.id) : null}</div>)}
      {order.refunds.map((refund) => <div key={refund.id}><p className={refund.voidedAt ? "line-through text-muted-foreground" : ""}>Refund {formatPeso(refund.amount)} · {refund.method} · {refund.refundedOn}</p>{refund.reason ? <p className="text-sm">{refund.reason}</p> : null}{refund.voidedAt ? <p className="text-sm">Voided: {refund.voidReason}</p> : order.status !== "completed" && !refund.supportCaseId ? correction("refund", refund.id) : null}</div>)}
      {!order.payments.length && !order.refunds.length ? <p>No money recorded.</p> : null}
      <div className="flex flex-wrap gap-3">
        {order.status === "in_progress" && order.totals.balance > 0 ? <ActionSheet title="Record payment"><ActionForm action={recordPaymentAction} submit="Record payment">{hidden}<MoneyFields kind="payment" amount={order.totals.balance} /></ActionForm></ActionSheet> : null}
        {order.status !== "completed" && order.totals.netPaid > 0 ? <ActionSheet title="Record refund"><ActionForm action={recordRefundAction} submit="Record refund" variant="destructive">{hidden}<MoneyFields kind="refund" amount={order.totals.refundDue || order.totals.netPaid} /><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" required />Confirm this money was returned to the purchaser.</label></ActionForm></ActionSheet> : null}
      </div>
    </section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Delivery</h2><p>{order.deliveryMethod?.replaceAll("_", " ") ?? "Not selected"} · Fee {formatPeso(order.shippingFee)}</p>{order.shipments.map((shipment) => <div key={shipment.id}><p>{shipment.status} · {shipment.courier} · {shipment.trackingNumber}</p><p>{shipment.shippedOn} {shipment.courierCost !== null ? `· Cost ${formatPeso(shipment.courierCost)}` : ""}</p></div>)}</section>
    {order.status === "in_progress" ? <section className="space-y-3"><h2 className="text-xl font-semibold">Order details</h2><ActionForm action={updateOrderDetailsAction} submit="Save order details">{hidden}
      <label className="flex flex-col gap-1 text-sm">Delivery method<select name="deliveryMethod" className={inputClass} defaultValue={order.deliveryMethod ?? "pickup"} disabled={order.anyReleased || order.hasCommercialDelivery}><option value="pickup">Pickup</option><option value="local_handoff">Local handoff</option><option value="courier">Courier</option></select></label>
      {order.anyReleased || order.hasCommercialDelivery ? <input type="hidden" name="deliveryMethod" value={order.deliveryMethod ?? ""} /> : null}
      <label className="flex flex-col gap-1 text-sm">Shipping fee (pesos, blank for zero)<Input name="shippingFee" inputMode="decimal" maxLength={30} defaultValue={order.shippingFee ? (order.shippingFee / 100).toFixed(2) : ""} /></label>
      <label className="flex flex-col gap-1 text-sm">Notes<Textarea name="notes" maxLength={500} defaultValue={order.notes ?? ""} /></label>
    </ActionForm></section> : order.notes ? <p>{order.notes}</p> : null}
    <section className="space-y-3"><h2 className="text-xl font-semibold">Assigned to</h2><ActionForm action={assignOrderAction} submit="Assign order">{hidden}<label className="flex flex-col gap-1 text-sm">Owner<select name="assignedToAccountId" className={inputClass} defaultValue={order.assignedToAccountId}>{order.assignees.map((owner) => <option key={owner.id} value={owner.id}>{owner.email}</option>)}</select></label></ActionForm><p className="text-sm text-muted-foreground">Last updated by {order.assignees.find((owner) => owner.id === order.updatedByAccountId)?.email ?? "Unknown account"} · {formatDateTime(order.updatedAt)}</p></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Internal note</h2><ActionForm action={addOrderNoteAction} submit="Add note">{hidden}<label className="flex flex-col gap-1 text-sm">Note<Textarea name="note" required maxLength={500} /></label></ActionForm></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Activity</h2>{order.timeline.map((event) => <div key={event.id} className="border-b py-3"><p>{event.type.replaceAll("_", " ")}</p>{event.note ? <p className="text-sm">{event.note}</p> : null}<p className="text-sm text-muted-foreground">{formatDateTime(event.createdAt)}</p></div>)}{!order.timeline.length ? <p>No activity yet.</p> : null}</section>
  </main>;
}
