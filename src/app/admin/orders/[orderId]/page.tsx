import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Activity, Ban, Banknote, Check, CircleAlert, Circle, CircleCheck, Clock, HandHelping, Hourglass, LifeBuoy, PackageCheck, PackageSearch, Trash2, Truck, Undo2, Users, Wrench } from "lucide-react";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { formatPeso } from "@/lib/money";
import { getOrderDetail } from "@/modules/orders/queries";
import { inventoryReference } from "@/modules/inventory/operations-view";
import { effectiveItemTotal } from "@/modules/orders/totals";
import { adminPage, quietText, checkLabel, controlClass, DangerZone, Disclosure, fieldLabel, Input, label, LinkButton, Textarea } from "../../ui";
import { Card, DetailHeader, KeyValueList, MetaRow, OutcomeRow, recordLink, StatePanel, StateText, SummaryStrip, Timeline, wrapText } from "../../detail-ui";
import { ActionForm } from "../../inventory/forms";
import { addOrderNoteAction, assignOrderAction, updateOrderDetailsAction, addOrderItemAction, updateOrderItemAction, removeOrderItemAction } from "./actions";
import { recordPaymentAction, recordRefundAction, voidPaymentAction, voidRefundAction } from "./actions";
import { allocateAvailableStockAction, reserveDbcCardsAction, returnCardToStockAction, handOverOrderAction, shipOrderAction, updateShipmentAction, correctShipmentDateAction } from "./actions";
import { JntDetailsForm, MarkShippedForm } from "./jnt-forms";
import { activityText, paymentMethodLabel, shipmentStatusLabel } from "./activity-text";
import { orderNextStep } from "./next-step";
import { cancelOrderAction } from "./actions";
import { ActionSheet } from "./action-sheet";
import { MoneyFields } from "./money-fields";
import { casesForOrder } from "@/modules/support/queries";

export const instant = false;

const quiet = quietText;
const manila = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(date);

export default async function OrderPage({ params }: Pick<PageProps<"/admin/orders/[orderId]">, "params">) {
  await requireOwner();
  await connection();
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  const order = await getOrderDetail(db, orderId);
  if (!order) notFound();
  const supportCases = await casesForOrder(db, orderId);
  const hidden = <input type="hidden" name="orderId" value={order.id} />;
  const normal = Boolean(order.clientKey);
  const pendingShipment = order.shipments.find((entry) => entry.status === "pending") ?? order.shipments[0] ?? null;
  const step = orderNextStep({ status: order.status, clientKey: order.clientKey ?? null, deliveryMethod: order.deliveryMethod, shippingFeePending: Boolean(order.shippingFeePending), items: order.items, cards: order.cards.map((card) => ({ id: card.id, state: card.state, ownerAccountId: card.ownerAccountId ?? null })), shipment: pendingShipment });
  const receiptOrder = [...order.payments].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt) || a.id.localeCompare(b.id)).map((payment) => payment.id);
  const receiptName = (paymentId: string) => (receiptOrder.indexOf(paymentId) === 0 ? "Product payment" : "Shipping payment");
  const canDeliver = order.cards.some((card) => card.state === "reserved") || (order.items.some((item) => item.productKind === "grc") && !order.hasCommercialDelivery);
  const today = manila(new Date());
  const feeText = !order.shippingFeePending && order.deliveryMethod === "courier" ? (order.shippingFee / 100).toFixed(2) : "";
  const destination = { recipientName: pendingShipment?.recipientName ?? order.purchaser.name, recipientPhone: pendingShipment?.recipientContact ?? order.purchaser.contactNumber ?? "", address: pendingShipment?.address ?? "" };
  const correction = (kind: "payment" | "refund", rowId: string, amount: number) => <ActionSheet title={`Void ${kind}`} variant="ghost"><ActionForm action={kind === "payment" ? voidPaymentAction : voidRefundAction} submit={`Void ${kind}`} variant="destructive" confirm={{ field: "confirm", icon: <Ban className="size-5" />, title: `Void this ${formatPeso(amount)} ${kind}?`, description: `The original entry stays on record but no longer counts towards Order ${order.number}'s totals. This is final.`, confirmLabel: `Void ${kind}` }}>{hidden}<input type="hidden" name={kind === "payment" ? "paymentId" : "refundId"} value={rowId} /><p className={quiet}>The original entry is kept. A void is final and excludes it from totals.</p><label className={fieldLabel}>Reason<Input name="reason" required maxLength={200} /></label></ActionForm></ActionSheet>;

  // What is left to do, derived only from the data already on this page.
  const toDo: { text: string; href: string }[] = [];
  if (order.status === "in_progress") {
    for (const item of order.items) if (item.productKind === "dbc" && item.allocatedCount < item.quantity) toDo.push({ text: `${order.clientKey ? "Allocate" : "Reserve"} DBC cards · ${item.name} (${item.quantity - item.allocatedCount} remaining)`, href: "#items" });
    if (!order.clientKey && order.totals.balance !== null && order.totals.balance > 0) toDo.push({ text: `Record payment · ${formatPeso(order.totals.balance)} due`, href: "#payments" });
    if (canDeliver && (order.deliveryMethod === "pickup" || order.deliveryMethod === "local_handoff")) toDo.push({ text: "Record handover", href: "#delivery" });
    if (canDeliver && order.deliveryMethod === "courier") toDo.push({ text: "Record shipment", href: "#delivery" });
  }

  const primaryTask = () => {
    switch (step.key) {
      case "waiting_for_stock":
        return <StatePanel tone="action" title="Waiting for stock" icon={Hourglass} description={`${step.remaining} ${step.remaining === 1 ? "card still needs" : "cards still need"} stock. The order and its payment are recorded; cards are allocated automatically when stock arrives.`}><div className="flex flex-wrap gap-3"><ActionForm action={allocateAvailableStockAction} submit="Allocate available stock" variant="primary">{hidden}</ActionForm><LinkButton icon={PackageSearch} href="/admin/inventory">Receive stock</LinkButton></div></StatePanel>;
      case "prepare_card":
        return <StatePanel tone="action" title="Prepare card" icon={Wrench} description={`${step.progress}. Write and test the NFC card with any untouched card, and keep it with you until preparation is complete.`}><div><LinkButton variant="action" href={`/admin/inventory/cards/${step.cardId}`}>Prepare card</LinkButton></div></StatePanel>;
      case "give_card":
        return <StatePanel tone="action" title="Ready for handoff" icon={HandHelping} description="Use this after physically giving the Neffi package to the customer. They can activate it afterward."><ActionForm action={handOverOrderAction} submit="Give card to customer" variant="primary" confirm={{ field: "confirm", icon: <HandHelping className="size-5" />, title: "Give the card to the customer?", description: `Order ${order.number}'s prepared cards are released to ${order.purchaser.name} and cannot be taken back.`, confirmLabel: "Give card to customer" }}>{hidden}</ActionForm></StatePanel>;
      case "complete_jnt":
        return <StatePanel tone="action" title="Enter J&T details" icon={Truck} description="Add the recipient name, phone and full address. The shipping fee can be saved now or confirmed when you mark the order as shipped."><div className="max-w-2xl"><JntDetailsForm orderId={order.id} initial={destination} fee={feeText} withFee /></div></StatePanel>;
      case "mark_shipped":
        return <StatePanel tone="action" title="Mark as shipped" icon={PackageCheck} description={<>Ship to {destination.recipientName} · {destination.recipientPhone}<br />{destination.address}</>}><div className="max-w-2xl"><MarkShippedForm orderId={order.id} fee={feeText} feeKnown={!order.shippingFeePending} today={today} earliest={manila(new Date(order.createdAt))} /></div></StatePanel>;
      case "waiting_for_activation":
        return <StatePanel title="Waiting for activation" icon={Clock} description="The customer activates by scanning the package QR and entering the private code. Nothing else is needed from you." />;
      case "activated":
        return <StatePanel title="Activated" icon={CircleCheck} description="Customer has activated the assigned Neffi. No further fulfillment action is required." />;
      default:
        return null;
    }
  };

  const updateShipmentSheet = (shipment: (typeof order.shipments)[number]) => <ActionSheet title="Update shipment"><ActionForm action={updateShipmentAction} submit="Save shipment">{hidden}<input type="hidden" name="shipmentId" value={shipment.id} />
          <label className={fieldLabel}>{normal ? "Delivery status" : "Status"}<select name="status" className={controlClass} defaultValue={shipment.status}>{["in_transit", "delivered", "failed", "returned", "lost"].map((status) => <option key={status} value={status}>{normal ? shipmentStatusLabel(status) : status.replaceAll("_", " ")}</option>)}</select></label>
          {normal ? null : <label className={fieldLabel}>Courier<Input name="courier" maxLength={100} defaultValue={shipment.courier ?? ""} /></label>}
          <label className={fieldLabel}>Tracking number<Input name="trackingNumber" maxLength={100} defaultValue={shipment.trackingNumber ?? ""} /></label>
          <label className={fieldLabel}>Courier cost (pesos, optional)<Input name="courierCost" inputMode="decimal" maxLength={30} defaultValue={shipment.courierCost !== null ? (shipment.courierCost / 100).toFixed(2) : ""} /></label>
          <p className={quiet}>Recording a delivery issue does not reopen the order.</p>
        </ActionForm></ActionSheet>;
  const correctDateSheet = (shipment: (typeof order.shipments)[number]) => <ActionSheet title="Correct shipped date"><ActionForm action={correctShipmentDateAction} submit="Correct shipped date">{hidden}<input type="hidden" name="shipmentId" value={shipment.id} /><label className={fieldLabel}>Shipped on<Input name="shippedOn" type="date" required min={manila(new Date(order.createdAt))} max={today} defaultValue={shipment.shippedOn ?? ""} /></label><label className={fieldLabel}>Reason<Input name="reason" required maxLength={200} /></label><p className={quiet}>The change is recorded in the order activity. The order stays shipped and completed.</p></ActionForm></ActionSheet>;
  const dbcItems = order.items.filter((item) => item.productKind === "dbc");
  const dbcQuantity = dbcItems.reduce((sum, item) => sum + item.quantity, 0);
  const dbcPrepared = dbcItems.reduce((sum, item) => sum + item.preparedCount, 0);
  const handedOver = order.timeline.find((event) => event.type === "order_handed_over");
  const remaining: Record<string, string> = {
    waiting_for_stock: "Waiting for stock before the cards can be prepared.",
    prepare_card: "Prepare the remaining cards, then give the package to the customer.",
    give_card: "Give the package to the customer.",
    complete_jnt: "Add the recipient details, then mark the order as shipped.",
    mark_shipped: "Hand the package to J&T, then record the tracking number.",
    waiting_for_activation: order.deliveryMethod === "courier" ? "Shipped. Waiting for the customer to activate." : "Handed over. Waiting for the customer to activate.",
    activated: "Delivered and activated. Nothing left to do.",
    cancelled: "This order was cancelled.",
  };
  const notYet = "Not added yet";
  const day = (iso: string) => formatDate(new Date(`${iso}T00:00:00+08:00`));
  const delivered = (card: (typeof order.cards)[number]) => card.state === "released";
  const shipmentFacts = (shipment: (typeof order.shipments)[number] | null) => {
    const identity: Rows = [
      ["Method", "J&T Express"],
      ["Recipient", shipment?.recipientName ? shipment.recipientName : notYet],
      ["Phone", shipment?.recipientContact || notYet],
      ["Address", shipment?.address ? <span className="whitespace-pre-wrap">{shipment.address}</span> : notYet],
    ];
    const logistics: Rows = [
      ["Shipping fee", order.shippingFeePending ? "To be confirmed" : <span className="tabular-nums">{formatPeso(order.shippingFee)}</span>],
      ["Tracking number", shipment?.trackingNumber ? <span className="font-mono">{shipment.trackingNumber}</span> : notYet],
      ["Shipped date", shipment?.shippedOn ? day(shipment.shippedOn) : "Not shipped yet"],
      ["Shipment status", shipment ? shipmentStatusLabel(shipment.status) : "Not shipped yet"],
      shipment?.courierCost != null && ["Courier cost", <span key="cost" className="tabular-nums">{formatPeso(shipment.courierCost)}</span>],
    ];
    return <div className="grid gap-x-8 gap-y-3 md:grid-cols-2"><KeyValueList rows={identity} /><KeyValueList rows={logistics} /></div>;
  };
  const deliveryName = normal ? (order.deliveryMethod === "courier" ? "J&T delivery" : "In person") : label(order.deliveryMethod) || "Delivery not selected";
  const DeliveryIcon = order.deliveryMethod === "courier" ? Truck : HandHelping;
  const StatusIcon = order.status === "completed" ? CircleCheck : order.status === "cancelled" ? Ban : Clock;
  const owes = order.totals.balance !== null && order.totals.balance > 0;
  const paymentText = normal && order.totals.balance === null && order.totals.netPaid >= order.totals.productSubtotal ? "Product paid" : order.totals.paymentState;
  const canRefund = order.status !== "completed" && order.totals.netPaid > 0;
  const canCancel = order.status === "in_progress";
  const dbcItem = dbcItems[0];
  const waitingRows = normal && dbcItem ? Math.max(0, dbcItem.quantity - dbcItem.allocatedCount) : 0;
  const fulfillmentGrid = "md:grid-cols-[minmax(0,1.5fr)_5.5rem_repeat(3,minmax(0,1fr))]";

  const itemsTable = dbcItem ? <div>
    <div aria-hidden className={`hidden gap-x-6 border-b bg-canvas/60 px-6 py-2 text-label font-medium text-fg-secondary md:grid ${fulfillmentGrid}`}><span>Product</span><span>Card</span><span>Preparation</span><span>Delivery</span><span>Card state</span></div>
    <ul className="divide-y">
      {order.cards.map((card) => {
        const prepared = card.state !== "preparing";
        const given = delivered(card);
        const activated = given && Boolean(card.ownerAccountId);
        return <li key={card.id} className={`grid gap-x-6 gap-y-2 px-4 py-4 sm:px-6 md:items-center ${fulfillmentGrid}`}>
          <ItemCell caption="Product"><span className="font-medium">{dbcItem.name}</span><span className={`${quiet} tabular-nums`}>{formatPeso(dbcItem.unitPrice)}</span></ItemCell>
          <ItemCell caption="Card"><Link className={`${recordLink} inline-flex min-h-8 items-center font-mono font-medium`} href={`/admin/inventory/cards/${card.id}`}>{inventoryReference(card.inventoryNumber)}</Link></ItemCell>
          <ItemCell caption="Preparation"><StateText icon={prepared ? Check : CircleAlert} tone={prepared ? "neutral" : "attention"}>{prepared ? "Prepared" : "Needs preparation"}</StateText></ItemCell>
          <ItemCell caption="Delivery"><StateText icon={given ? Check : Clock}>{given ? (order.shipments.some((entry) => entry.shippedOn) ? "Shipped" : "Given to customer") : "Not delivered yet"}</StateText></ItemCell>
          <ItemCell caption="Card state"><StateText icon={activated ? Check : given ? Clock : Circle}>{activated ? "Activated" : given ? "Awaiting activation" : "Assigned"}</StateText></ItemCell>
        </li>;
      })}
      {Array.from({ length: waitingRows }, (_, index) => <li key={`waiting-${index}`} className={`grid gap-x-6 gap-y-2 px-4 py-4 sm:px-6 md:items-center ${fulfillmentGrid}`}>
        <ItemCell caption="Product"><span className="font-medium">{dbcItem.name}</span><span className={`${quiet} tabular-nums`}>{formatPeso(dbcItem.unitPrice)}</span></ItemCell>
        <ItemCell caption="Card"><StateText icon={Hourglass} tone="attention">Waiting</StateText></ItemCell>
        <ItemCell caption="Preparation"><StateText icon={Circle}>Not started</StateText></ItemCell>
        <ItemCell caption="Delivery"><StateText icon={Clock}>Not delivered yet</StateText></ItemCell>
        <ItemCell caption="Card state"><StateText icon={Circle}>Not assigned</StateText></ItemCell>
      </li>)}
    </ul>
    {order.deliveryMethod === "courier" ? <p className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t px-4 py-3 text-body sm:px-6">{order.shippingFeePending ? <span className="font-medium">J&amp;T Shipping — To be confirmed</span> : <><span className="font-medium">J&amp;T Shipping</span><span className="tabular-nums">{formatPeso(order.shippingFee)}</span></>}</p> : null}
  </div> : null;

  const legacyItems = <ul className="divide-y">
    {order.items.map((item) => <li key={item.id} className="flex flex-col gap-1 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1"><h3 className="text-body font-medium">{item.name}{item.label ? ` · ${item.label}` : ""}</h3><p className="text-body tabular-nums"><span className="text-fg-secondary">{item.quantity} × {formatPeso(item.unitPrice)}</span> · <span className="font-semibold">Total {formatPeso(effectiveItemTotal(item))}</span></p></div>
      {item.agreedTotal !== null ? <p className={quiet}>Adjustment: {formatPeso(item.quantity * item.unitPrice - item.agreedTotal)}</p> : null}
      {item.productKind === "dbc" ? <p className={quiet}>{item.allocatedCount} allocated · {item.preparedCount} prepared · {item.releasedCount} released</p> : <p className={quiet}>Manual programming · Commercial delivery {order.hasCommercialDelivery ? "recorded" : "pending"}</p>}
      {item.reviewUrl ? <a className={`${recordLink} break-all text-meta`} href={item.reviewUrl}>{item.reviewUrl}</a> : null}
    </li>)}
    {order.cards.length ? <li className="flex flex-wrap gap-x-6 gap-y-1 bg-canvas/60 px-4 py-3 sm:px-6">{order.cards.map((card) => <span key={card.id}><Link className={`${recordLink} inline-flex min-h-8 items-center text-meta`} href={`/admin/inventory/cards/${card.id}`}>{inventoryReference(card.inventoryNumber)} · {card.state}</Link></span>)}</li> : null}
  </ul>;

  const legacyItemForms = order.status === "in_progress" && !normal ? <>
    <div className="flex flex-wrap gap-2 border-t px-4 py-4 sm:px-6">
      {order.items.filter((item) => item.productKind === "dbc" && !order.clientKey && item.allocatedCount < item.quantity).map((item) => <ActionSheet key={item.id} title={`Reserve DBC cards · ${item.name}`}>
        <p>{item.quantity - item.allocatedCount} card(s) remaining on this line.</p>
        {order.readyDbcCards.some((card) => card.productId === item.productId) ? <ActionForm action={reserveDbcCardsAction} submit="Reserve selected DBCs" variant="primary">{hidden}<input type="hidden" name="orderItemId" value={item.id} />
          {order.readyDbcCards.filter((card) => card.productId === item.productId).map((card) => <label key={card.id} className={`${checkLabel} items-center border-b`}><input type="checkbox" name="cardId" value={card.id} /><span>{inventoryReference(card.inventoryNumber)} · Received {card.receivedOn}</span></label>)}
        </ActionForm> : <p>No Ready DBCs for this product. <Link className={recordLink} href="/admin/inventory">Open Inventory</Link></p>}
      </ActionSheet>)}
      {order.cards.filter((card) => card.state === "reserved").map((card) => <ActionSheet key={card.id} title={`Return ${inventoryReference(card.inventoryNumber)} to stock`}><ActionForm action={returnCardToStockAction} submit="Return to stock" confirm={{ field: "confirm", icon: <Undo2 className="size-5" />, title: `Return ${inventoryReference(card.inventoryNumber)} to stock?`, description: `The card leaves Order ${order.number} and goes back to Ready stock. For a lost package, replace its credential from Inventory afterward.`, confirmLabel: "Return to stock" }}>{hidden}<input type="hidden" name="cardId" value={card.id} /><p className={quiet}>Returns this DBC to Ready stock. For a lost package, replace its credential from Inventory afterward.</p></ActionForm></ActionSheet>)}
    </div>
    <div className="flex flex-col gap-3 border-t p-4 sm:p-6">
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
    </div>
  </> : null;

  const moneyRow = (kind: "payment" | "refund", row: { id: string; amount: number; voidedAt: Date | string | null; voidReason: string | null }, name: string, detail: string, extra: ReactNode, canVoid: boolean) => <li key={row.id} className={`flex items-start justify-between gap-4 px-4 py-3 sm:px-6 ${row.voidedAt ? "text-fg-secondary" : ""}`}>
    <div className="flex min-w-0 flex-col gap-1">
      <p className={`text-body ${row.voidedAt ? "line-through" : ""}`}><span className="font-medium">{name}</span><span className="text-fg-secondary"> · {detail}</span></p>
      {extra}
      {row.voidedAt ? <p className={quiet}>Voided: {row.voidReason}</p> : canVoid ? <div>{correction(kind, row.id, row.amount)}</div> : null}
    </div>
    <p className={`shrink-0 text-body font-semibold tabular-nums ${row.voidedAt ? "line-through" : ""}`}>{formatPeso(row.amount)}</p>
  </li>;

  const deliveryCard = <Card id="delivery" title="Delivery" icon={DeliveryIcon} flush
    description={normal ? undefined : `${order.deliveryMethod?.replaceAll("_", " ") ?? "Not selected"} · Fee ${order.shippingFeePending ? "pending" : formatPeso(order.shippingFee)}`}>
    {normal ? <>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {order.deliveryMethod === "courier"
          ? (order.shipments.length ? order.shipments : [null]).map((shipment, index) => <div key={shipment?.id ?? "pending"} className={`flex flex-col gap-4 ${index > 0 ? "border-t pt-4" : ""}`}>
            {shipmentFacts(shipment)}
            {shipment && shipment.shippedOn ? <div className="flex flex-wrap gap-2">{correctDateSheet(shipment)}{order.status !== "cancelled" ? updateShipmentSheet(shipment) : null}</div> : null}
          </div>)
          : <KeyValueList columns={2} rows={[
            ["Method", "In person"],
            dbcPrepared < dbcQuantity && ["Preparation", `${dbcPrepared} of ${dbcQuantity} prepared`],
            ["Handoff", handedOver || order.cards.some((card) => card.state === "released") ? "Given to customer" : "Not given yet"],
            handedOver && ["Handoff date", formatDateTime(handedOver.createdAt)],
            order.cards.length > 0 && ["Card", <span key="cards" className="flex flex-wrap gap-x-3">{order.cards.map((card) => <Link key={card.id} className={`${recordLink} font-mono`} href={`/admin/inventory/cards/${card.id}`}>{inventoryReference(card.inventoryNumber)}</Link>)}</span>],
          ]} />}
        {order.status === "in_progress" && order.deliveryMethod === "courier" && step.key !== "complete_jnt" && !order.shipments.some((entry) => entry.shippedOn) ? <Disclosure summary="Edit J&T details"><JntDetailsForm orderId={order.id} initial={destination} fee={feeText} withFee={false} /></Disclosure> : null}
      </div>
      {remaining[step.key] ? <OutcomeRow done={["waiting_for_activation", "activated", "cancelled"].includes(step.key)}>{["waiting_for_activation", "activated"].includes(step.key) ? "No delivery action remaining." : remaining[step.key]}</OutcomeRow> : null}
    </> : <>
      {order.shipments.length ? <ul className="divide-y">{order.shipments.map((shipment) => <li key={shipment.id} className="flex flex-col gap-1.5 px-4 py-4 text-body sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1"><p className={`font-medium ${wrapText}`}>{shipment.courier} · {shipment.trackingNumber ?? "No tracking number yet"}</p><StateText>{shipment.status.replaceAll("_", " ")}</StateText></div>
        <p className={quiet}>{shipment.shippedOn} {shipment.courierCost !== null ? `· Cost ${formatPeso(shipment.courierCost)}` : ""}</p><p className={`${quiet} ${wrapText}`}>{shipment.recipientName} {shipment.recipientContact}</p>{shipment.address ? <p className={`${quiet} whitespace-pre-wrap`}>{shipment.address}</p> : null}
        {order.status !== "cancelled" ? <div>{updateShipmentSheet(shipment)}</div> : null}
      </li>)}</ul> : null}
      {order.status === "in_progress" && canDeliver && (order.deliveryMethod === "pickup" || order.deliveryMethod === "local_handoff" || order.deliveryMethod === "courier") ? <div className="flex flex-wrap gap-2 p-4 sm:p-6">
        {order.deliveryMethod !== "courier" ? <ActionSheet title="Hand over"><ActionForm action={handOverOrderAction} submit="Record handover" variant="primary" confirm={{ field: "confirm", icon: <HandHelping className="size-5" />, title: "Record this handover?", description: `The goods are marked as handed to ${order.purchaser.name}. Reserved DBCs are released and cannot be taken back, and any Google Review Card goods count as delivered.`, confirmLabel: "Record handover" }}>{hidden}<p>Releases all Reserved DBCs and records commercial delivery of the GRC goods, if present.</p></ActionForm></ActionSheet>
          : <ActionSheet title="Ship"><ActionForm action={shipOrderAction} submit="Record shipment" variant="primary" confirm={{ field: "confirm", icon: <Truck className="size-5" />, title: "Record this shipment?", description: `The goods are marked as handed to the courier for Order ${order.number}. Reserved DBCs are released and cannot be taken back.`, confirmLabel: "Record shipment" }}>{hidden}
            <label className={fieldLabel}>Shipped on<Input name="shippedOn" type="date" defaultValue={today} /></label>
            <label className={fieldLabel}>Courier (optional)<Input name="courier" maxLength={100} /></label>
            <label className={fieldLabel}>Tracking number (optional)<Input name="trackingNumber" maxLength={100} /></label>
            <label className={fieldLabel}>Recipient (optional)<Input name="recipientName" maxLength={100} defaultValue={order.purchaser.name} /></label>
            <label className={fieldLabel}>Recipient contact (optional)<Input name="recipientContact" maxLength={100} defaultValue={order.purchaser.contactNumber ?? ""} /></label>
            <label className={fieldLabel}>Address (optional)<Textarea name="address" maxLength={500} /></label>
            <label className={fieldLabel}>Courier cost (pesos, optional)<Input name="courierCost" inputMode="decimal" maxLength={30} /></label>
          </ActionForm></ActionSheet>}
      </div> : null}
    </>}
  </Card>;

  const paymentsCard = <Card id="payments" title="Payments" icon={Banknote} flush>
    {order.payments.length || order.refunds.length ? <ul className="divide-y">
      {order.payments.map((payment) => moneyRow("payment", payment, normal ? (order.payments.length === 1 && order.deliveryMethod !== "courier" ? "Payment" : receiptName(payment.id)) : "Payment", `${normal ? paymentMethodLabel(payment.method) : payment.method} · ${day(payment.paidOn)}`, payment.reference ? <p className={`${quiet} ${wrapText}`}>{payment.reference}</p> : null, order.status === "in_progress"))}
      {order.refunds.map((refund) => moneyRow("refund", refund, refund.supportCaseId ? "After-sale refund" : "Refund", `${refund.method} · ${day(refund.refundedOn)}`, <>
        {refund.supportCaseId ? <Link className={`${recordLink} inline-flex min-h-8 items-center text-meta`} href={`/admin/support/${refund.supportCaseId}`}>View support case</Link> : null}
        {refund.reason ? <p className={`${quiet} ${wrapText}`}>{refund.reason}</p> : null}
      </>, order.status !== "completed" && !refund.supportCaseId))}
    </ul> : <p className={`${quiet} px-4 py-4 sm:px-6`}>No money recorded.</p>}
    {order.status === "in_progress" && !order.clientKey && owes ? <div className="border-t px-4 py-3 sm:px-6"><ActionSheet title="Record payment"><ActionForm action={recordPaymentAction} submit="Record payment" variant="primary">{hidden}<MoneyFields kind="payment" amount={order.totals.balance!} /></ActionForm></ActionSheet></div> : null}
  </Card>;

  return <main data-admin-section="orders" className={adminPage}>
    <DetailHeader
      back={{ href: "/admin/orders", label: "Orders" }}
      title={`Order ${order.number}`}
      subtitle={<><Link className={recordLink} href={`/admin/customers/purchasers/${order.purchaserId}`}>{order.purchaser.name}</Link>{order.purchaser.contactNumber ? <span> · {order.purchaser.contactNumber}</span> : null}</>}
      meta={<MetaRow items={[{ icon: StatusIcon, text: label(order.status) }, { icon: Banknote, text: paymentText, tone: owes ? "attention" : "default" }, { icon: DeliveryIcon, text: deliveryName }]} />}
      actions={<LinkButton icon={LifeBuoy} href={`/admin/support/new?orderId=${order.id}&purchaserId=${order.purchaserId}`}>Open support case</LinkButton>}
    />
    {normal && step.key !== "cancelled" ? primaryTask() : null}
    {order.status === "cancelled" ? <StatePanel title="Cancelled" icon={Ban} description={`${order.cancellationReason ?? "This order was cancelled."} Any refund due is shown in the order summary.`} /> : null}
    <SummaryStrip label="Order summary" items={[["Order total", order.totals.orderTotal], ["Net paid", order.totals.netPaid], ["Balance", order.totals.balance], ["Refund due", order.totals.refundDue]].map(([name, value]) => ({ label: name as string, value: value === null ? (normal ? "Pending" : "Pending shipping") : formatPeso(value as number) }))} />
    {!normal && toDo.length ? <Card title="To do" flush><ul className="divide-y">{toDo.map((entry) => <li key={entry.text}><a href={entry.href} className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-body nav-interact transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6"><span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand" />{entry.text}</a></li>)}</ul></Card> : null}
    {order.status === "completed" && owes ? <p role="status" className="rounded-panel border border-amber-500/40 bg-background p-4 text-body">Balance due after correction: {formatPeso(order.totals.balance!)}</p> : null}
    {order.status === "completed" && (order.totals.afterSaleRefunded ?? 0) > 0 ? <p className={quiet}>After-sale refunds: {formatPeso(order.totals.afterSaleRefunded ?? 0)}</p> : null}

    <Card id="items" title="Items & fulfillment" icon={PackageCheck} flush>
      {normal ? itemsTable : legacyItems}
      {legacyItemForms}
    </Card>

    {deliveryCard}
    {paymentsCard}

    {order.status === "in_progress" && !normal ? <Card title="Order details"><div className="max-w-xl"><ActionForm action={updateOrderDetailsAction} submit="Save order details">{hidden}
      <label className={fieldLabel}>Delivery method<select name="deliveryMethod" className={controlClass} defaultValue={order.deliveryMethod ?? "pickup"} disabled={order.anyReleased || order.hasCommercialDelivery}><option value="pickup">Pickup</option><option value="local_handoff">Local handoff</option><option value="courier">Courier</option></select></label>
      {order.anyReleased || order.hasCommercialDelivery ? <input type="hidden" name="deliveryMethod" value={order.deliveryMethod ?? ""} /> : null}
      <label className={fieldLabel}>Shipping fee (pesos, blank for zero)<Input name="shippingFee" inputMode="decimal" maxLength={30} defaultValue={order.shippingFee ? (order.shippingFee / 100).toFixed(2) : ""} /></label>
      <label className={fieldLabel}>Notes<Textarea name="notes" maxLength={500} defaultValue={order.notes ?? ""} /></label>
    </ActionForm></div></Card> : order.notes ? <p className="text-body">{order.notes}</p> : null}

    <Card title="Operations" icon={Users}>
      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <div className="flex flex-col gap-3">
          <h3 className="text-body font-medium">Assigned to</h3>
          <ActionForm action={assignOrderAction} submit="Assign order">{hidden}<label className={fieldLabel}>Owner<select name="assignedToAccountId" className={controlClass} defaultValue={order.assignedToAccountId}>{order.assignees.map((owner) => <option key={owner.id} value={owner.id}>{owner.email}</option>)}</select></label></ActionForm>
          <p className={quiet}>Last updated by {order.assignees.find((owner) => owner.id === order.updatedByAccountId)?.email ?? "Unknown account"} · {formatDateTime(order.updatedAt)}</p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-body font-medium">Internal note</h3>
          <ActionForm action={addOrderNoteAction} submit="Add note">{hidden}<label className={fieldLabel}>Note<Textarea name="note" required maxLength={500} /></label></ActionForm>
        </div>
        <div className="flex flex-col gap-3 border-t pt-6 md:col-span-2">
          <h3 className="text-body font-medium">Support cases</h3>
          {supportCases.length ? <ul className="-mx-2 flex flex-col">{supportCases.map((support) => <li key={support.id}><Link className="group flex min-h-11 items-center justify-between gap-4 rounded-lg px-2 py-2 text-body nav-interact transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand" href={`/admin/support/${support.id}`}><span className={`min-w-0 underline decoration-border-strong underline-offset-4 group-hover:decoration-foreground ${wrapText}`}>{support.summary}</span><StateText tone={support.status === "open" ? "attention" : "neutral"}>{label(support.status)}</StateText></Link></li>)}</ul> : <p className={quiet}>No support cases linked to this order.</p>}
        </div>
      </div>
    </Card>

    <Card title="Activity" icon={Activity}>
      <Timeline entries={order.timeline.map((event) => ({ id: event.id, at: new Date(event.createdAt), ...(normal ? activityText(event) : { title: label(event.type), detail: event.note ?? undefined }) }))} />
    </Card>

    {canCancel || canRefund ? <DangerZone title={canCancel ? "Refunds and cancellation" : "Refunds"}>
      <div className="flex flex-col divide-y">
        {canRefund ? <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3 first:pt-0 last:pb-0"><p className={`${quiet} max-w-prose`}>Record money returned to the customer. It lowers what this order counts as paid.</p><ActionSheet title="Record refund" destructive><ActionForm action={recordRefundAction} submit="Record refund" variant="destructive" confirm={{ field: "confirm", icon: <Banknote className="size-5" />, title: "Record this refund?", description: `This records that the money was returned to ${order.purchaser.name}. It lowers what Order ${order.number} counts as paid.`, confirmLabel: "Record refund" }}>{hidden}<MoneyFields kind="refund" amount={order.totals.refundDue || order.totals.netPaid} /></ActionForm></ActionSheet></div> : null}
        {canCancel ? (order.anyReleased || order.hasCommercialDelivery
          ? <p className={`${quiet} py-3 first:pt-0 last:pb-0`}>This order has already been released or delivered and cannot be cancelled.</p>
          : <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3 first:pt-0 last:pb-0"><p className={`${quiet} max-w-prose`}>Cancelling is final. Reserved cards return to stock and payment history is kept.</p><ActionSheet title="Cancel order" destructive><ActionForm action={cancelOrderAction} submit="Cancel order" variant="destructive" confirm={{ field: "confirm", icon: <Ban className="size-5" />, title: `Cancel Order ${order.number}?`, description: "Reserved DBCs return to stock and payment history is kept. Any refund has to be recorded separately. Cancelling is final.", confirmLabel: "Cancel order", dismissLabel: "Keep order" }}>{hidden}<p>Returns Reserved DBCs to stock and keeps all payment history. Record any refund separately.</p><label className={fieldLabel}>Reason (optional)<Textarea name="reason" maxLength={500} /></label></ActionForm></ActionSheet></div>) : null}
      </div>
    </DangerZone> : null}
  </main>;
}

type Rows = Parameters<typeof KeyValueList>[0]["rows"];

// One cell of a fulfillment row: labelled on phones, where each row stacks, and bare on md+ under the column header.
function ItemCell({ caption, children }: { caption: string; children: ReactNode }) {
  return <div className="flex flex-col gap-0.5 max-md:flex-row max-md:items-baseline max-md:justify-between max-md:gap-4"><span className="text-label text-fg-secondary md:hidden">{caption}</span><span className="flex min-w-0 flex-col items-start gap-0.5 max-md:items-end max-md:text-right">{children}</span></div>;
}
