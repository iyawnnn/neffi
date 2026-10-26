import { formatPeso } from "@/lib/money";

const METHODS: Record<string, string> = { gcash: "GCash", maya: "Maya", maribank: "MariBank", gotyme: "GoTyme", bank_transfer: "Bank transfer", cash: "Cash" };
const STATUSES: Record<string, string> = { pending: "Pending", in_transit: "In transit", delivered: "Delivered", failed: "Failed", returned: "Returned", lost: "Lost" };
export const paymentMethodLabel = (method: string) => METHODS[method] ?? method;
export const shipmentStatusLabel = (status: string) => STATUSES[status] ?? status;

const TITLES: Record<string, string> = {
  order_created: "Order created", card_provisioned: "Card assigned and ready for NFC writing", card_nfc_verified: "NFC test confirmed", card_reserved: "Card prepared for this order",
  card_ready: "Card prepared", card_released: "Card released to the customer", order_handed_over: "Card given to customer", shipment_recorded: "Marked as shipped", order_completed: "Order completed",
  card_returned: "Card returned to stock", order_cancelled: "Order cancelled", order_assigned: "Order assigned", note: "Note", payment_voided: "Payment voided", refund_recorded: "Refund recorded", refund_voided: "Refund voided",
  shipment_updated: "Shipment updated", stock_received: "Stock received", card_retired: "Card retired", activation_credential_replaced: "Package code replaced", support_order_linked: "Linked to a support case",
};

// Owner-readable activity for normal orders. Raw amounts, tokens and credential details never appear; owner notes and
// correction reasons do, because they are what the owner wrote.
export function activityText(event: { type: string; note: string | null }): { title: string; detail?: string } {
  if (event.type === "payment_recorded") {
    const match = event.note?.match(/^(\d+) centavos; (\w+)(; shipping)?$/);
    if (match) return { title: `${match[3] ? "Shipping" : "Product"} payment received · ${formatPeso(Number(match[1]))} · ${paymentMethodLabel(match[2])}` };
    return { title: "Payment received" };
  }
  const title = TITLES[event.type] ?? event.type.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
  const showsNote = ["note", "shipment_updated", "order_cancelled", "payment_voided", "refund_recorded", "refund_voided", "card_retired", "activation_credential_replaced"].includes(event.type);
  return showsNote && event.note ? { title, detail: event.note } : { title };
}
