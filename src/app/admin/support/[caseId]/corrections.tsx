import type { ReactNode } from "react";
import type { getCaseDetail } from "@/modules/support/queries";
import type { ActionState } from "../../inventory/actions";
import { formatPeso } from "@/lib/money";
import { fieldLabel, Input, Section, Select, Textarea } from "../../ui";
import { ActionForm } from "../../inventory/forms";
import { ActionSheet } from "../../orders/[orderId]/action-sheet";
import { MoneyFields } from "../../orders/[orderId]/money-fields";
import * as actions from "./actions";

type Detail = NonNullable<Awaited<ReturnType<typeof getCaseDetail>>>;
type Action = (previous: ActionState | undefined, data: FormData) => Promise<ActionState>;
const hidden = (name: string, value: string) => <input name={name} value={value} type="hidden" />;

// Titles can carry an amount and a date ("Void payment · ₱200.00 · 2026-10-01"); the confirmation uses the first part.
function Correction({ title, action, caseId, children, consequence, destructive = false, verification = false, hasReason = false }: { title: string; action: Action; caseId: string; children: ReactNode; consequence: string; destructive?: boolean; verification?: boolean; hasReason?: boolean }) {
  const short = title.split(" · ")[0];
  return <ActionSheet title={title}><ActionForm action={action} submit={title} variant={destructive ? "destructive" : "primary"} confirm={{ field: "confirm", title: `${short}?`, confirmLabel: short, description: verification ? `${consequence} Only continue if you have verified the purchase and the requester's claim.` : consequence }}>{hidden("caseId", caseId)}{children}
    {!hasReason ? <label className={fieldLabel}>{verification ? "Verification note — what did you check?" : "Reason"}<Textarea name={verification ? "verificationNote" : "reason"} required maxLength={verification ? 500 : 200} /></label> : null}
  </ActionForm></ActionSheet>;
}

function ShipmentFields({ shipment }: { shipment?: Detail["shipments"][number] }) {
  return <>{shipment ? <>{hidden("shipmentId", shipment.id)}<label className={fieldLabel}>Status<Select name="status" defaultValue={shipment.status}>{["in_transit", "delivered", "failed", "returned", "lost"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</Select></label></> : <label className={fieldLabel}>Shipped on (today if blank)<Input name="shippedOn" type="date" /></label>}
    {(["courier", "trackingNumber"] as const).map((name) => <label key={name} className={fieldLabel}>{name === "courier" ? "Courier" : "Tracking number"} (optional)<Input name={name} maxLength={100} defaultValue={shipment?.[name] ?? ""} /></label>)}
    {!shipment ? <>{[["recipientName", "Recipient"], ["recipientContact", "Recipient contact"]].map(([name, label]) => <label key={name} className={fieldLabel}>{label} (optional)<Input name={name} maxLength={100} /></label>)}<label className={fieldLabel}>Address (optional)<Textarea name="address" maxLength={500} /></label></> : null}
    <label className={fieldLabel}>Courier cost (pesos, blank to clear)<Input name="courierCost" inputMode="decimal" maxLength={30} defaultValue={shipment?.courierCost != null ? (shipment.courierCost / 100).toFixed(2) : ""} /></label>
  </>;
}

export function CaseCorrections({ support }: { support: Detail }) {
  if (support.status === "resolved") return null;
  const caseId = support.id;
  const order = support.order;
  const canFulfill = order && order.status !== "cancelled";
  return <Section title="Corrections" description="Every correction is recorded in Activity. Do not paste activation codes, identity documents or secrets into notes.">
    {order?.status === "completed" ? <div className="flex flex-col gap-3"><h3 className="text-body font-medium">Completed-order money</h3><div className="flex flex-wrap gap-2">
      {order.totals.netPaid > 0 ? <Correction caseId={caseId} title="After-sale refund" action={actions.afterSaleRefundAction} destructive hasReason consequence="Money goes back to the purchaser without reopening the order or creating a balance. The refund is recorded against this case.">{hidden("orderId", order.id)}<p>Returns money without reopening the order or creating a balance. Maximum {formatPeso(order.totals.netPaid)}.</p><MoneyFields kind="refund" amount={order.totals.netPaid} reasonRequired /></Correction> : null}
      {order.totals.balance !== null && order.totals.balance > 0 ? <Correction caseId={caseId} title="Record corrected payment" action={actions.recordCompletedPaymentAction} consequence="The payment is added to this completed order and recorded in this case's Activity.">{hidden("orderId", order.id)}<p>Maximum {formatPeso(order.totals.balance)}.</p><MoneyFields kind="payment" amount={order.totals.balance} /></Correction> : null}
      {order.payments.filter((row) => !row.voidedAt).map((payment) => <Correction key={payment.id} caseId={caseId} title={`Void payment · ${formatPeso(payment.amount)} · ${payment.paidOn}`} action={actions.voidCompletedPaymentAction} destructive consequence="The original payment stays on record but no longer counts towards the order. This is final and can leave a balance due.">{hidden("orderId", order.id)}{hidden("paymentId", payment.id)}<p>The original payment is kept. This void is final and may create a balance due after correction.</p></Correction>)}
      {support.refunds.filter((row) => !row.voidedAt).map((refund) => <Correction key={refund.id} caseId={caseId} title={`Void after-sale refund · ${formatPeso(refund.amount)} · ${refund.refundedOn}`} action={actions.voidAfterSaleRefundAction} destructive consequence="The original refund stays on record but no longer counts towards the order totals. This is final.">{hidden("orderId", order.id)}{hidden("refundId", refund.id)}<p>The original refund is kept. This void is final and excludes it from totals.</p></Correction>)}
    </div></div> : null}
    <div className="flex flex-col gap-3"><h3 className="text-body font-medium">Card corrections</h3>{support.cards.filter((card) => card.kind === "dbc" && card.state === "released").map((card) => <div key={card.id} className="flex flex-wrap items-center gap-3 rounded-panel border bg-background px-4 sm:px-5 py-3"><p>DBC …{card.suffix}</p>
      {canFulfill && card.role === "affected" && order.items.some((item) => item.id === card.orderItemId) ? <Correction caseId={caseId} title={`Retire card …${card.suffix}`} action={actions.retireAffectedCardAction} destructive consequence="The card goes offline, disappears from the customer's cards and its unused code is revoked. This is final.">{hidden("cardId", card.id)}<p>This is final. The card goes offline and disappears from the customer&apos;s cards. Its URL remains unchanged and unavailable. Its unused code is revoked and ownership and routing are cleared.</p></Correction> : null}
      <Correction caseId={caseId} title={card.ownerAccountId ? `Reset ownership …${card.suffix}` : `Issue new code …${card.suffix}`} action={card.ownerAccountId ? actions.resetCardOwnershipAction : actions.reissueActivationCodeAction} destructive verification consequence={card.ownerAccountId ? "The current Account loses this card and it goes offline until the verified requester claims it again." : "The old unused code stops working for good. A new code is shown once, so copy it before closing."}>{hidden("cardId", card.id)}<p>{card.ownerAccountId ? "The old Account loses this card and keeps its Profile. The card goes offline until the verified requester claims it and connects a Profile. Used codes stay used. This does not move the Profile or merge Accounts." : "The old unused code stops working permanently. A new code is shown once for delivery outside Neffi."}</p><p>Record what was checked without copying IDs or secrets. Copy the new code before closing this sheet.</p></Correction>
    </div>)}
      {canFulfill ? order.items.filter((item) => item.productKind === "dbc" && item.allocatedCount < item.quantity && support.cards.filter((card) => card.orderItemId === item.id && card.role === "affected" && card.state === "retired" && card.retiredByCase).length > support.cards.filter((card) => card.orderItemId === item.id && card.role === "replacement").length).map((item) => <Correction key={item.id} caseId={caseId} title={`Release free replacement · ${item.name}`} action={actions.releaseReplacementCardAction} consequence="The chosen Ready card is released to this order at no charge. No new sale, item or payment is created.">{hidden("orderItemId", item.id)}<p>No new sale, item or payment is created. The customer claims the replacement and reconnects their Profile.</p><label className={fieldLabel}>Ready DBC<Select name="cardId" required defaultValue=""><option value="" disabled>Choose a Ready DBC</option>{order.readyDbcCards.filter((card) => card.productId === item.productId).map((card) => <option key={card.id} value={card.id}>…{card.suffix} · Stock received {card.receivedOn}</option>)}</Select></label>{!order.readyDbcCards.some((card) => card.productId === item.productId) ? <p>Prepare a Ready DBC of this product in Inventory first.</p> : null}</Correction>) : null}
    </div>
    {canFulfill ? <div className="flex flex-col gap-3"><h3 className="text-body font-medium">Shipping follow-up</h3><p className="text-meta text-fg-secondary">Support shipments do not change order completion. Update the original shipment&apos;s failed, returned or lost status from the order.</p><div className="flex flex-wrap gap-2"><Correction caseId={caseId} title="Record support shipment" action={actions.recordSupportShipmentAction} consequence="Records a re-send already handed to the courier. It does not change whether the order is complete."><p>Records a replacement or re-send already handed to the courier.</p><ShipmentFields /></Correction>{support.shipments.map((shipment) => <Correction key={shipment.id} caseId={caseId} title={`Update support shipment · ${shipment.trackingNumber ?? shipment.shippedOn}`} action={actions.updateSupportShipmentAction} consequence="Updates this shipment's status, courier and cost."><ShipmentFields shipment={shipment} /></Correction>)}</div></div> : null}
  </Section>;
}
