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
import { reserveDbcCardsAction, returnCardToStockAction, handOverOrderAction, shipOrderAction, updateShipmentAction } from "./actions";
import { cancelOrderAction } from "./actions";
import { ActionSheet } from "./action-sheet";
import { MoneyFields } from "./money-fields";
import { casesForOrder } from "@/modules/support/queries";

export const instant = false;

export default async function OrderPage({ params }: Pick<PageProps<"/admin/orders/[orderId]">, "params">) {
  await requireOwner();
  await connection();
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  const order = await getOrderDetail(db, orderId);
  if (!order) notFound();
  const supportCases = await casesForOrder(db, orderId);
  const hidden = <input type="hidden" name="orderId" value={order.id} />;
  const canDeliver = order.cards.some((card) => card.state === "reserved") || (order.items.some((item) => item.productKind === "grc") && !order.hasCommercialDelivery);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const correction = (kind: "payment" | "refund", rowId: string) => <ActionSheet title={`Void ${kind}`}><ActionForm action={kind === "payment" ? voidPaymentAction : voidRefundAction} submit={`Void ${kind}`} variant="destructive">{hidden}<input type="hidden" name={kind === "payment" ? "paymentId" : "refundId"} value={rowId} /><p className="text-sm">The original entry is kept. A void is final and excludes it from totals.</p><label className="flex flex-col gap-1 text-sm">Reason<Input name="reason" required maxLength={200} /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input name="confirm" type="checkbox" required />Confirm this correction.</label></ActionForm></ActionSheet>;
  return <main data-admin-section="orders" className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 sm:p-8">
    <header className="space-y-2"><Link className="inline-flex min-h-11 items-center underline" href="/admin/orders">Orders</Link><h1 className="text-2xl font-semibold">Order {order.number}</h1><p>{order.status.replaceAll("_", " ")} · {order.totals.paymentState}</p><Link className="underline" href={`/admin/customers/purchasers/${order.purchaserId}`}>{order.purchaser.name}</Link>{order.purchaser.contactNumber ? <p>{order.purchaser.contactNumber}</p> : null}</header>
    <dl className="grid grid-cols-2 gap-4 tabular-nums sm:grid-cols-4">{[["Order total", order.totals.orderTotal], ["Net paid", order.totals.netPaid], ["Balance", order.totals.balance], ["Refund due", order.totals.refundDue]].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="text-lg font-semibold">{formatPeso(value as number)}</dd></div>)}</dl>
    {order.status === "completed" && order.totals.balance > 0 ? <p role="status" className="rounded-lg border p-4">Balance due after correction: {formatPeso(order.totals.balance)}</p> : null}
    {order.status === "completed" ? <p>After-sale refunds: {formatPeso(order.totals.afterSaleRefunded ?? 0)}</p> : null}
    <section className="space-y-3"><h2 className="text-xl font-semibold">Support cases</h2><Link className="flex min-h-11 items-center underline" href={`/admin/support/new?orderId=${order.id}&purchaserId=${order.purchaserId}`}>Open support case</Link>{supportCases.map((support) => <Link key={support.id} className="flex min-h-11 items-center underline" href={`/admin/support/${support.id}`}>{support.summary} · {support.status.replaceAll("_", " ")}</Link>)}{!supportCases.length ? <p>No support cases linked to this order.</p> : null}</section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Items &amp; fulfillment</h2>
      {order.items.map((item) => <div key={item.id} className="space-y-2 border-b pb-4"><h3 className="font-medium">{item.name}{item.label ? ` · ${item.label}` : ""}</h3><p className="tabular-nums">{item.quantity} × {formatPeso(item.unitPrice)} · Total {formatPeso(effectiveItemTotal(item))}</p>{item.agreedTotal !== null ? <p className="text-sm">Adjustment: {formatPeso(item.quantity * item.unitPrice - item.agreedTotal)}</p> : null}{item.productKind === "dbc" ? <p className="text-sm">{item.activeCount} reserved or released · {item.releasedCount} released</p> : <p className="text-sm text-muted-foreground">Manual programming · Commercial delivery {order.hasCommercialDelivery ? "recorded" : "pending"}</p>}{item.reviewUrl ? <a className="block break-all underline" href={item.reviewUrl}>{item.reviewUrl}</a> : null}</div>)}
      {order.cards.map((card) => <Link className="flex min-h-11 items-center gap-3 underline" key={card.id} href={`/admin/inventory/cards/${card.id}`}>{card.kind?.toUpperCase()} {card.suffix ?? card.id.slice(-4)} · {card.state}</Link>)}
      {order.status === "in_progress" ? <div className="flex flex-wrap gap-3">
        {order.items.filter((item) => item.productKind === "dbc" && item.activeCount < item.quantity).map((item) => <ActionSheet key={item.id} title={`Reserve DBC cards · ${item.name}`}>
          <p>{item.quantity - item.activeCount} card(s) remaining on this line.</p>
          {order.readyDbcCards.some((card) => card.productId === item.productId) ? <ActionForm action={reserveDbcCardsAction} submit="Reserve selected DBCs">{hidden}<input type="hidden" name="orderItemId" value={item.id} />
            {order.readyDbcCards.filter((card) => card.productId === item.productId).map((card) => <label key={card.id} className="flex min-h-11 items-center gap-3 border-b py-3"><input type="checkbox" name="cardId" value={card.id} /><span>DBC {card.suffix} · Received {card.receivedOn}</span></label>)}
          </ActionForm> : <p>No Ready DBCs for this product. <Link className="underline" href="/admin/inventory">Open Inventory</Link></p>}
        </ActionSheet>)}
        {order.cards.filter((card) => card.state === "reserved").map((card) => <ActionSheet key={card.id} title={`Return DBC ${card.suffix ?? ""} to stock`}><ActionForm action={returnCardToStockAction} submit="Return to stock">{hidden}<input type="hidden" name="cardId" value={card.id} /><p className="text-sm">Returns this DBC to Ready stock. For a lost package, replace its credential from Inventory afterward.</p><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="confirm" required />Confirm this card is back in stock.</label></ActionForm></ActionSheet>)}
      </div> : null}
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
      {order.refunds.map((refund) => <div key={refund.id}><p className={refund.voidedAt ? "line-through text-muted-foreground" : ""}>{refund.supportCaseId ? "After-sale refund" : "Refund"} {formatPeso(refund.amount)} · {refund.method} · {refund.refundedOn}</p>{refund.supportCaseId ? <Link className="flex min-h-11 items-center underline" href={`/admin/support/${refund.supportCaseId}`}>View support case</Link> : null}{refund.reason ? <p className="text-sm">{refund.reason}</p> : null}{refund.voidedAt ? <p className="text-sm">Voided: {refund.voidReason}</p> : order.status !== "completed" && !refund.supportCaseId ? correction("refund", refund.id) : null}</div>)}
      {!order.payments.length && !order.refunds.length ? <p>No money recorded.</p> : null}
      <div className="flex flex-wrap gap-3">
        {order.status === "in_progress" && order.totals.balance > 0 ? <ActionSheet title="Record payment"><ActionForm action={recordPaymentAction} submit="Record payment">{hidden}<MoneyFields kind="payment" amount={order.totals.balance} /></ActionForm></ActionSheet> : null}
        {order.status !== "completed" && order.totals.netPaid > 0 ? <ActionSheet title="Record refund"><ActionForm action={recordRefundAction} submit="Record refund" variant="destructive">{hidden}<MoneyFields kind="refund" amount={order.totals.refundDue || order.totals.netPaid} /><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" required />Confirm this money was returned to the purchaser.</label></ActionForm></ActionSheet> : null}
      </div>
    </section>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Delivery</h2><p>{order.deliveryMethod?.replaceAll("_", " ") ?? "Not selected"} · Fee {formatPeso(order.shippingFee)}</p>
      {order.status === "in_progress" && canDeliver && (order.deliveryMethod === "pickup" || order.deliveryMethod === "local_handoff") ? <ActionSheet title="Hand over"><ActionForm action={handOverOrderAction} submit="Record handover">{hidden}<p>Releases all Reserved DBCs and records commercial delivery of the GRC goods, if present.</p><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="confirm" required />Confirm these goods were handed to the purchaser.</label></ActionForm></ActionSheet> : null}
      {order.status === "in_progress" && canDeliver && order.deliveryMethod === "courier" ? <ActionSheet title="Ship"><ActionForm action={shipOrderAction} submit="Record shipment">{hidden}
        <label className="flex flex-col gap-1 text-sm">Shipped on<Input name="shippedOn" type="date" defaultValue={today} /></label>
        <label className="flex flex-col gap-1 text-sm">Courier (optional)<Input name="courier" maxLength={100} /></label>
        <label className="flex flex-col gap-1 text-sm">Tracking number (optional)<Input name="trackingNumber" maxLength={100} /></label>
        <label className="flex flex-col gap-1 text-sm">Recipient (optional)<Input name="recipientName" maxLength={100} defaultValue={order.purchaser.name} /></label>
        <label className="flex flex-col gap-1 text-sm">Recipient contact (optional)<Input name="recipientContact" maxLength={100} defaultValue={order.purchaser.contactNumber ?? ""} /></label>
        <label className="flex flex-col gap-1 text-sm">Address (optional)<Textarea name="address" maxLength={500} /></label>
        <label className="flex flex-col gap-1 text-sm">Courier cost (pesos, optional)<Input name="courierCost" inputMode="decimal" maxLength={30} /></label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="confirm" required />Confirm these goods were handed to the courier.</label>
      </ActionForm></ActionSheet> : null}
      {order.shipments.map((shipment) => <div key={shipment.id} className="space-y-2 border-b pb-4"><p>{shipment.status} · {shipment.courier} · {shipment.trackingNumber}</p><p>{shipment.shippedOn} {shipment.courierCost !== null ? `· Cost ${formatPeso(shipment.courierCost)}` : ""}</p><p>{shipment.recipientName} {shipment.recipientContact}</p>{shipment.address ? <p className="whitespace-pre-wrap">{shipment.address}</p> : null}
        {order.status !== "cancelled" ? <ActionSheet title="Update shipment"><ActionForm action={updateShipmentAction} submit="Save shipment">{hidden}<input type="hidden" name="shipmentId" value={shipment.id} />
          <label className="flex flex-col gap-1 text-sm">Status<select name="status" className={inputClass} defaultValue={shipment.status}>{["in_transit", "delivered", "failed", "returned", "lost"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm">Courier<Input name="courier" maxLength={100} defaultValue={shipment.courier ?? ""} /></label>
          <label className="flex flex-col gap-1 text-sm">Tracking number<Input name="trackingNumber" maxLength={100} defaultValue={shipment.trackingNumber ?? ""} /></label>
          <label className="flex flex-col gap-1 text-sm">Courier cost (pesos, optional)<Input name="courierCost" inputMode="decimal" maxLength={30} defaultValue={shipment.courierCost !== null ? (shipment.courierCost / 100).toFixed(2) : ""} /></label>
          <p className="text-sm text-muted-foreground">Recording a delivery issue does not reopen the order.</p>
        </ActionForm></ActionSheet> : null}
      </div>)}
    </section>
    {order.status === "in_progress" ? <section className="space-y-3"><h2 className="text-xl font-semibold">Order details</h2><ActionForm action={updateOrderDetailsAction} submit="Save order details">{hidden}
      <label className="flex flex-col gap-1 text-sm">Delivery method<select name="deliveryMethod" className={inputClass} defaultValue={order.deliveryMethod ?? "pickup"} disabled={order.anyReleased || order.hasCommercialDelivery}><option value="pickup">Pickup</option><option value="local_handoff">Local handoff</option><option value="courier">Courier</option></select></label>
      {order.anyReleased || order.hasCommercialDelivery ? <input type="hidden" name="deliveryMethod" value={order.deliveryMethod ?? ""} /> : null}
      <label className="flex flex-col gap-1 text-sm">Shipping fee (pesos, blank for zero)<Input name="shippingFee" inputMode="decimal" maxLength={30} defaultValue={order.shippingFee ? (order.shippingFee / 100).toFixed(2) : ""} /></label>
      <label className="flex flex-col gap-1 text-sm">Notes<Textarea name="notes" maxLength={500} defaultValue={order.notes ?? ""} /></label>
    </ActionForm></section> : order.notes ? <p>{order.notes}</p> : null}
    <section className="space-y-3"><h2 className="text-xl font-semibold">Assigned to</h2><ActionForm action={assignOrderAction} submit="Assign order">{hidden}<label className="flex flex-col gap-1 text-sm">Owner<select name="assignedToAccountId" className={inputClass} defaultValue={order.assignedToAccountId}>{order.assignees.map((owner) => <option key={owner.id} value={owner.id}>{owner.email}</option>)}</select></label></ActionForm><p className="text-sm text-muted-foreground">Last updated by {order.assignees.find((owner) => owner.id === order.updatedByAccountId)?.email ?? "Unknown account"} · {formatDateTime(order.updatedAt)}</p></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Internal note</h2><ActionForm action={addOrderNoteAction} submit="Add note">{hidden}<label className="flex flex-col gap-1 text-sm">Note<Textarea name="note" required maxLength={500} /></label></ActionForm></section>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Activity</h2>{order.timeline.map((event) => <div key={event.id} className="border-b py-3"><p>{event.type.replaceAll("_", " ")}</p>{event.note ? <p className="text-sm">{event.note}</p> : null}<p className="text-sm text-muted-foreground">{formatDateTime(event.createdAt)}</p></div>)}{!order.timeline.length ? <p>No activity yet.</p> : null}</section>
    {order.status === "in_progress" ? <section className="space-y-3"><h2 className="text-xl font-semibold">Cancellation</h2>
      {order.anyReleased || order.hasCommercialDelivery ? <p>This order has already been released or delivered and cannot be cancelled.</p> : <ActionSheet title="Cancel order"><ActionForm action={cancelOrderAction} submit="Cancel order" variant="destructive">{hidden}<p>Returns Reserved DBCs to stock and keeps all payment history. Record any refund separately.</p><label className="flex flex-col gap-1 text-sm">Reason (optional)<Textarea name="reason" maxLength={500} /></label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="confirm" required />Confirm cancellation. This is final.</label></ActionForm></ActionSheet>}
    </section> : order.status === "cancelled" ? <p>Cancelled{order.cancellationReason ? `: ${order.cancellationReason}` : ""}. Any refund due is shown above.</p> : null}
  </main>;
}
