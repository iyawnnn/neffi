import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Ban, Banknote, HandHelping, LifeBuoy, Trash2, Truck, Undo2 } from "lucide-react";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format-date";
import { formatPeso } from "@/lib/money";
import { getOrderDetail } from "@/modules/orders/queries";
import { effectiveItemTotal } from "@/modules/orders/totals";
import { adminPage, caseTone, inlineLink, quietText, checkLabel, controlClass, DangerZone, Disclosure, fieldLabel, Input, label, LinkButton, orderTone, PageHeader, Panel, Section, shipmentTone, StatStrip, Status, Textarea } from "../../ui";
import { ActionForm } from "../../inventory/forms";
import { addOrderNoteAction, assignOrderAction, updateOrderDetailsAction, addOrderItemAction, updateOrderItemAction, removeOrderItemAction } from "./actions";
import { recordPaymentAction, recordRefundAction, voidPaymentAction, voidRefundAction } from "./actions";
import { reserveDbcCardsAction, returnCardToStockAction, handOverOrderAction, shipOrderAction, updateShipmentAction } from "./actions";
import { cancelOrderAction } from "./actions";
import { ActionSheet } from "./action-sheet";
import { MoneyFields } from "./money-fields";
import { casesForOrder } from "@/modules/support/queries";

export const instant = false;

const link = inlineLink;
const quiet = quietText;

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
  const correction = (kind: "payment" | "refund", rowId: string, amount: number) => <ActionSheet title={`Void ${kind}`}><ActionForm action={kind === "payment" ? voidPaymentAction : voidRefundAction} submit={`Void ${kind}`} variant="destructive" confirm={{ field: "confirm", icon: <Ban className="size-5" />, title: `Void this ${formatPeso(amount)} ${kind}?`, description: `The original entry stays on record but no longer counts towards Order ${order.number}'s totals. This is final.`, confirmLabel: `Void ${kind}` }}>{hidden}<input type="hidden" name={kind === "payment" ? "paymentId" : "refundId"} value={rowId} /><p className={quiet}>The original entry is kept. A void is final and excludes it from totals.</p><label className={fieldLabel}>Reason<Input name="reason" required maxLength={200} /></label></ActionForm></ActionSheet>;

  // What is left to do, derived only from the data already on this page.
  const toDo: { text: string; href: string }[] = [];
  if (order.status === "in_progress") {
    for (const item of order.items) if (item.productKind === "dbc" && item.allocatedCount < item.quantity) toDo.push({ text: `${order.clientKey ? "Allocate" : "Reserve"} DBC cards · ${item.name} (${item.quantity - item.allocatedCount} remaining)`, href: "#items" });
    if (!order.clientKey && order.totals.balance !== null && order.totals.balance > 0) toDo.push({ text: `Record payment · ${formatPeso(order.totals.balance)} due`, href: "#payments" });
    if (canDeliver && (order.deliveryMethod === "pickup" || order.deliveryMethod === "local_handoff")) toDo.push({ text: "Record handover", href: "#delivery" });
    if (canDeliver && order.deliveryMethod === "courier") toDo.push({ text: "Record shipment", href: "#delivery" });
  }

  return <main data-admin-section="orders" className={adminPage}>
    <PageHeader
      back={{ href: "/admin/orders", label: "Orders" }}
      title={`Order ${order.number}`}
      description={<span className="flex flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><Status tone={orderTone(order.status)}>{label(order.status)}</Status><span>{order.totals.paymentState}</span></span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><Link className={link} href={`/admin/customers/purchasers/${order.purchaserId}`}>{order.purchaser.name}</Link>{order.purchaser.contactNumber ? <span>{order.purchaser.contactNumber}</span> : null}</span>
      </span>}
      actions={<LinkButton icon={LifeBuoy} href={`/admin/support/new?orderId=${order.id}&purchaserId=${order.purchaserId}`}>Open support case</LinkButton>}
    />
    <StatStrip items={[["Order total", order.totals.orderTotal], ["Net paid", order.totals.netPaid], ["Balance", order.totals.balance], ["Refund due", order.totals.refundDue]].map(([name, value]) => ({ label: name as string, value: value === null ? "Pending shipping" : formatPeso(value as number) }))} />
    {toDo.length ? <Section title="To do"><Panel><ul className="divide-y">{toDo.map((entry) => <li key={entry.text}><a href={entry.href} className="flex min-h-12 items-center gap-3 px-4 sm:px-5 py-2.5 text-body nav-interact transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"><span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand" />{entry.text}</a></li>)}</ul></Panel></Section> : null}
    {order.status === "completed" && order.totals.balance !== null && order.totals.balance > 0 ? <p role="status" className="rounded-panel border border-amber-500/40 bg-background p-4 text-body">Balance due after correction: {formatPeso(order.totals.balance)}</p> : null}
    {order.status === "completed" ? <p className={quiet}>After-sale refunds: {formatPeso(order.totals.afterSaleRefunded ?? 0)}</p> : null}

    <Section title="Support cases" description={supportCases.length ? undefined : "No support cases linked to this order."}>
      {supportCases.length ? <Panel><ul className="divide-y">{supportCases.map((support) => <li key={support.id}><Link className="group flex min-h-12 items-center justify-between gap-4 px-4 sm:px-5 py-2.5 text-body nav-interact transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand" href={`/admin/support/${support.id}`}><span className="min-w-0 break-words">{support.summary}</span><Status tone={caseTone(support.status)}>{label(support.status)}</Status></Link></li>)}</ul></Panel> : null}
    </Section>

    <Section id="items" title="Items & fulfillment">
      <Panel>
        <ul className="divide-y">
          {order.items.map((item) => <li key={item.id} className="flex flex-col gap-1 px-4 sm:px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"><h3 className="text-body font-medium">{item.name}{item.label ? ` · ${item.label}` : ""}</h3><p className="text-body tabular-nums">{item.quantity} × {formatPeso(item.unitPrice)} · Total {formatPeso(effectiveItemTotal(item))}</p></div>
            {item.agreedTotal !== null ? <p className={quiet}>Adjustment: {formatPeso(item.quantity * item.unitPrice - item.agreedTotal)}</p> : null}
            {item.productKind === "dbc" ? <p className={quiet}>{item.allocatedCount} allocated · {item.preparedCount} prepared · {item.releasedCount} released</p> : <p className={quiet}>Manual programming · Commercial delivery {order.hasCommercialDelivery ? "recorded" : "pending"}</p>}
            {item.reviewUrl ? <a className={`${link} break-all text-meta`} href={item.reviewUrl}>{item.reviewUrl}</a> : null}
          </li>)}
        </ul>
        {order.cards.length ? <ul className="flex flex-wrap gap-x-6 gap-y-1 border-t bg-canvas/60 px-4 sm:px-5 py-3">{order.cards.map((card) => <li key={card.id}><Link className={`${link} inline-flex min-h-8 items-center gap-2 text-meta`} href={`/admin/inventory/cards/${card.id}`}>{card.kind?.toUpperCase()} {card.suffix ?? card.id.slice(-4)} · {card.state}</Link></li>)}</ul> : null}
      </Panel>
      {order.status === "in_progress" ? <div className="flex flex-wrap gap-2">
        {order.items.filter((item) => item.productKind === "dbc" && !order.clientKey && item.allocatedCount < item.quantity).map((item) => <ActionSheet key={item.id} title={`Reserve DBC cards · ${item.name}`}>
          <p>{item.quantity - item.allocatedCount} card(s) remaining on this line.</p>
          {order.readyDbcCards.some((card) => card.productId === item.productId) ? <ActionForm action={reserveDbcCardsAction} submit="Reserve selected DBCs" variant="primary">{hidden}<input type="hidden" name="orderItemId" value={item.id} />
            {order.readyDbcCards.filter((card) => card.productId === item.productId).map((card) => <label key={card.id} className={`${checkLabel} items-center border-b`}><input type="checkbox" name="cardId" value={card.id} /><span>DBC {card.suffix} · Received {card.receivedOn}</span></label>)}
          </ActionForm> : <p>No Ready DBCs for this product. <Link className={link} href="/admin/inventory">Open Inventory</Link></p>}
        </ActionSheet>)}
        {order.cards.filter((card) => card.state === "reserved").map((card) => <ActionSheet key={card.id} title={`Return DBC ${card.suffix ?? ""} to stock`}><ActionForm action={returnCardToStockAction} submit="Return to stock" confirm={{ field: "confirm", icon: <Undo2 className="size-5" />, title: `Return DBC ${card.suffix ?? ""} to stock?`, description: `The card leaves Order ${order.number} and goes back to Ready stock. For a lost package, replace its credential from Inventory afterward.`, confirmLabel: "Return to stock" }}>{hidden}<input type="hidden" name="cardId" value={card.id} /><p className={quiet}>Returns this DBC to Ready stock. For a lost package, replace its credential from Inventory afterward.</p></ActionForm></ActionSheet>)}
      </div> : null}
      {order.status === "in_progress" && !order.clientKey ? <div className="flex flex-col gap-3">
        {order.items.map((item) => <Disclosure key={item.id} summary={`Edit ${item.name}${item.label ? ` · ${item.label}` : ""}`}>
          <ActionForm action={updateOrderItemAction} submit="Save item">{hidden}<input type="hidden" name="orderItemId" value={item.id} />
            <label className={fieldLabel}>Quantity<Input name="quantity" type="number" inputMode="numeric" min={1} max={500} required defaultValue={item.quantity} readOnly={item.productKind === "grc" && order.hasCommercialDelivery} /></label>
            <label className={fieldLabel}>Agreed line total (pesos, blank for catalog total)<Input name="agreedTotal" inputMode="decimal" maxLength={30} defaultValue={item.agreedTotal !== null ? (item.agreedTotal / 100).toFixed(2) : ""} /></label>
            {item.productKind === "grc" ? <><label className={fieldLabel}>Branch label (optional)<Input name="label" maxLength={100} defaultValue={item.label ?? ""} /></label><label className={fieldLabel}>Direct review URL (optional)<Input name="reviewUrl" type="url" maxLength={2048} defaultValue={item.reviewUrl ?? ""} /></label></> : null}
          </ActionForm>
          {order.items.length > 1 && !(item.productKind === "grc" && order.hasCommercialDelivery) ? <div className="border-t pt-4"><ActionForm action={removeOrderItemAction} submit="Remove item" variant="destructive" confirm={{ field: "confirm", icon: <Trash2 className="size-5" />, title: "Remove this line?", description: `${item.quantity} × ${item.name}${item.label ? ` · ${item.label}` : ""} comes off Order ${order.number}, and the order total drops by ${formatPeso(effectiveItemTotal(item))}.`, confirmLabel: "Remove item" }}>{hidden}<input type="hidden" name="orderItemId" value={item.id} /></ActionForm></div> : null}
        </Disclosure>)}
        {(["grc"] as const).filter(() => !order.hasCommercialDelivery).map((kind) => <Disclosure key={kind} summary={`Add ${kind.toUpperCase()} line`}><ActionForm action={addOrderItemAction} submit="Add item">{hidden}<input type="hidden" name="kind" value={kind} />
          <label className={fieldLabel}>Quantity<Input name="quantity" type="number" inputMode="numeric" min={1} max={500} defaultValue={1} required /></label>
          <label className={fieldLabel}>Agreed line total (pesos, optional)<Input name="agreedTotal" inputMode="decimal" maxLength={30} /></label>
          {kind === "grc" ? <><label className={fieldLabel}>Branch label (optional)<Input name="label" maxLength={100} /></label><label className={fieldLabel}>Direct review URL (optional)<Input name="reviewUrl" type="url" maxLength={2048} /></label></> : null}
        </ActionForm></Disclosure>)}
      </div> : null}
    </Section>

    <Section id="payments" title="Payments & refunds">
      {order.payments.length || order.refunds.length ? <Panel><ul className="divide-y">
        {order.payments.map((payment) => <li key={payment.id} className={`flex flex-col gap-1 px-4 sm:px-5 py-3.5 ${payment.voidedAt ? "text-fg-secondary" : ""}`}><p className={`text-body ${payment.voidedAt ? "line-through" : ""}`}>Payment {formatPeso(payment.amount)} · {payment.method} · {payment.paidOn}</p>{payment.reference ? <p className={quiet}>{payment.reference}</p> : null}{payment.voidedAt ? <p className={quiet}>Voided: {payment.voidReason}</p> : order.status === "in_progress" ? <div>{correction("payment", payment.id, payment.amount)}</div> : null}</li>)}
        {order.refunds.map((refund) => <li key={refund.id} className="flex flex-col gap-1 px-4 sm:px-5 py-3.5"><p className={`text-body ${refund.voidedAt ? "line-through text-fg-secondary" : ""}`}>{refund.supportCaseId ? "After-sale refund" : "Refund"} {formatPeso(refund.amount)} · {refund.method} · {refund.refundedOn}</p>{refund.supportCaseId ? <Link className={`${link} inline-flex min-h-8 items-center text-meta`} href={`/admin/support/${refund.supportCaseId}`}>View support case</Link> : null}{refund.reason ? <p className={quiet}>{refund.reason}</p> : null}{refund.voidedAt ? <p className={quiet}>Voided: {refund.voidReason}</p> : order.status !== "completed" && !refund.supportCaseId ? <div>{correction("refund", refund.id, refund.amount)}</div> : null}</li>)}
      </ul></Panel> : <p className={quiet}>No money recorded.</p>}
      <div className="flex flex-wrap gap-2">
        {order.status === "in_progress" && !order.clientKey && order.totals.balance !== null && order.totals.balance > 0 ? <ActionSheet title="Record payment"><ActionForm action={recordPaymentAction} submit="Record payment" variant="primary">{hidden}<MoneyFields kind="payment" amount={order.totals.balance} /></ActionForm></ActionSheet> : null}
        {order.status !== "completed" && order.totals.netPaid > 0 ? <ActionSheet title="Record refund"><ActionForm action={recordRefundAction} submit="Record refund" variant="destructive" confirm={{ field: "confirm", icon: <Banknote className="size-5" />, title: "Record this refund?", description: `This records that the money was returned to ${order.purchaser.name}. It lowers what Order ${order.number} counts as paid.`, confirmLabel: "Record refund" }}>{hidden}<MoneyFields kind="refund" amount={order.totals.refundDue || order.totals.netPaid} /></ActionForm></ActionSheet> : null}
      </div>
    </Section>

    <Section id="delivery" title="Delivery" description={`${order.deliveryMethod?.replaceAll("_", " ") ?? "Not selected"} · Fee ${order.shippingFeePending ? "pending" : formatPeso(order.shippingFee)}`}>
      <div className="flex flex-wrap gap-2">
        {order.status === "in_progress" && canDeliver && (order.deliveryMethod === "pickup" || order.deliveryMethod === "local_handoff") ? <ActionSheet title="Hand over"><ActionForm action={handOverOrderAction} submit="Record handover" variant="primary" confirm={{ field: "confirm", icon: <HandHelping className="size-5" />, title: "Record this handover?", description: `The goods are marked as handed to ${order.purchaser.name}. Reserved DBCs are released and cannot be taken back, and any Google Review Card goods count as delivered.`, confirmLabel: "Record handover" }}>{hidden}<p>Releases all Reserved DBCs and records commercial delivery of the GRC goods, if present.</p></ActionForm></ActionSheet> : null}
        {order.status === "in_progress" && canDeliver && order.deliveryMethod === "courier" ? <ActionSheet title="Ship"><ActionForm action={shipOrderAction} submit="Record shipment" variant="primary" confirm={{ field: "confirm", icon: <Truck className="size-5" />, title: "Record this shipment?", description: `The goods are marked as handed to the courier for Order ${order.number}. Reserved DBCs are released and cannot be taken back.`, confirmLabel: "Record shipment" }}>{hidden}
          <label className={fieldLabel}>Shipped on<Input name="shippedOn" type="date" defaultValue={today} /></label>
          <label className={fieldLabel}>Courier (optional)<Input name="courier" maxLength={100} /></label>
          <label className={fieldLabel}>Tracking number (optional)<Input name="trackingNumber" maxLength={100} /></label>
          <label className={fieldLabel}>Recipient (optional)<Input name="recipientName" maxLength={100} defaultValue={order.purchaser.name} /></label>
          <label className={fieldLabel}>Recipient contact (optional)<Input name="recipientContact" maxLength={100} defaultValue={order.purchaser.contactNumber ?? ""} /></label>
          <label className={fieldLabel}>Address (optional)<Textarea name="address" maxLength={500} /></label>
          <label className={fieldLabel}>Courier cost (pesos, optional)<Input name="courierCost" inputMode="decimal" maxLength={30} /></label>
        </ActionForm></ActionSheet> : null}
      </div>
      {order.shipments.length ? <Panel><ul className="divide-y">{order.shipments.map((shipment) => <li key={shipment.id} className="flex flex-col gap-1.5 px-4 sm:px-5 py-4 text-body">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1"><p className="font-medium">{shipment.courier} · {shipment.trackingNumber}</p><Status tone={shipmentTone(shipment.status)}>{shipment.status}</Status></div>
        <p className={quiet}>{shipment.shippedOn} {shipment.courierCost !== null ? `· Cost ${formatPeso(shipment.courierCost)}` : ""}</p><p className={quiet}>{shipment.recipientName} {shipment.recipientContact}</p>{shipment.address ? <p className={`${quiet} whitespace-pre-wrap`}>{shipment.address}</p> : null}
        {order.status !== "cancelled" ? <div><ActionSheet title="Update shipment"><ActionForm action={updateShipmentAction} submit="Save shipment">{hidden}<input type="hidden" name="shipmentId" value={shipment.id} />
          <label className={fieldLabel}>Status<select name="status" className={controlClass} defaultValue={shipment.status}>{["in_transit", "delivered", "failed", "returned", "lost"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
          <label className={fieldLabel}>Courier<Input name="courier" maxLength={100} defaultValue={shipment.courier ?? ""} /></label>
          <label className={fieldLabel}>Tracking number<Input name="trackingNumber" maxLength={100} defaultValue={shipment.trackingNumber ?? ""} /></label>
          <label className={fieldLabel}>Courier cost (pesos, optional)<Input name="courierCost" inputMode="decimal" maxLength={30} defaultValue={shipment.courierCost !== null ? (shipment.courierCost / 100).toFixed(2) : ""} /></label>
          <p className={quiet}>Recording a delivery issue does not reopen the order.</p>
        </ActionForm></ActionSheet></div> : null}
      </li>)}</ul></Panel> : null}
    </Section>

    {order.status === "in_progress" ? <Section title="Order details"><Panel padded className="max-w-xl"><ActionForm action={updateOrderDetailsAction} submit="Save order details">{hidden}
      <label className={fieldLabel}>Delivery method<select name="deliveryMethod" className={controlClass} defaultValue={order.deliveryMethod ?? "pickup"} disabled={order.anyReleased || order.hasCommercialDelivery}><option value="pickup">Pickup</option><option value="local_handoff">Local handoff</option><option value="courier">Courier</option></select></label>
      {order.anyReleased || order.hasCommercialDelivery ? <input type="hidden" name="deliveryMethod" value={order.deliveryMethod ?? ""} /> : null}
      <label className={fieldLabel}>Shipping fee (pesos, blank for zero)<Input name="shippingFee" inputMode="decimal" maxLength={30} defaultValue={order.shippingFee ? (order.shippingFee / 100).toFixed(2) : ""} /></label>
      <label className={fieldLabel}>Notes<Textarea name="notes" maxLength={500} defaultValue={order.notes ?? ""} /></label>
    </ActionForm></Panel></Section> : order.notes ? <p className="text-body">{order.notes}</p> : null}

    <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
      <Section title="Assigned to"><Panel padded><ActionForm action={assignOrderAction} submit="Assign order">{hidden}<label className={fieldLabel}>Owner<select name="assignedToAccountId" className={controlClass} defaultValue={order.assignedToAccountId}>{order.assignees.map((owner) => <option key={owner.id} value={owner.id}>{owner.email}</option>)}</select></label></ActionForm><p className={`${quiet} mt-4`}>Last updated by {order.assignees.find((owner) => owner.id === order.updatedByAccountId)?.email ?? "Unknown account"} · {formatDateTime(order.updatedAt)}</p></Panel></Section>
      <Section title="Internal note"><Panel padded><ActionForm action={addOrderNoteAction} submit="Add note">{hidden}<label className={fieldLabel}>Note<Textarea name="note" required maxLength={500} /></label></ActionForm></Panel></Section>
    </div>

    <Section title="Activity"><Panel>{order.timeline.length ? <ul className="divide-y">{order.timeline.map((event) => <li key={event.id} className="flex flex-col gap-0.5 px-4 sm:px-5 py-3"><p className="text-body font-medium">{event.type.replaceAll("_", " ")}</p>{event.note ? <p className={quiet}>{event.note}</p> : null}<p className={`${quiet} tabular-nums`}>{formatDateTime(event.createdAt)}</p></li>)}</ul> : <p className="px-4 sm:px-5 py-4 text-meta text-fg-secondary">No activity yet.</p>}</Panel></Section>

    {order.status === "in_progress" ? <DangerZone title="Cancellation">
      {order.anyReleased || order.hasCommercialDelivery ? <p className={quiet}>This order has already been released or delivered and cannot be cancelled.</p> : <div><ActionSheet title="Cancel order"><ActionForm action={cancelOrderAction} submit="Cancel order" variant="destructive" confirm={{ field: "confirm", icon: <Ban className="size-5" />, title: `Cancel Order ${order.number}?`, description: "Reserved DBCs return to stock and payment history is kept. Any refund has to be recorded separately. Cancelling is final.", confirmLabel: "Cancel order", dismissLabel: "Keep order" }}>{hidden}<p>Returns Reserved DBCs to stock and keeps all payment history. Record any refund separately.</p><label className={fieldLabel}>Reason (optional)<Textarea name="reason" maxLength={500} /></label></ActionForm></ActionSheet></div>}
    </DangerZone> : order.status === "cancelled" ? <p className={quiet}>Cancelled{order.cancellationReason ? `: ${order.cancellationReason}` : ""}. Any refund due is shown above.</p> : null}
  </main>;
}
