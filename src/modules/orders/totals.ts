export type ItemFacts = { productKind: "dbc" | "grc"; quantity: number; unitPrice: number; agreedTotal: number | null; activeCount: number; releasedCount: number };
export type OrderFacts = {
  status: "in_progress" | "completed" | "cancelled";
  deliveryMethod: "pickup" | "local_handoff" | "courier" | null;
  shippingFee: number;
  shippingFeePending?: boolean;
  items: ItemFacts[];
  received: number;
  refunded: number;
  afterSaleRefunded?: number;
  hasShippedShipment: boolean;
  hasHandedOver: boolean;
};

export function effectiveItemTotal(item: Pick<ItemFacts, "quantity" | "unitPrice" | "agreedTotal">): number {
  return item.agreedTotal ?? item.quantity * item.unitPrice;
}

export function orderTotals(facts: OrderFacts) {
  const productSubtotal = facts.items.reduce((sum, item) => sum + effectiveItemTotal(item), 0);
  const orderTotal = facts.shippingFeePending ? null : productSubtotal + facts.shippingFee;
  const { received, refunded, afterSaleRefunded = 0 } = facts;
  const settledPaid = received - refunded;
  const netPaid = settledPaid - afterSaleRefunded;
  return {
    productSubtotal, shippingFeePending: Boolean(facts.shippingFeePending), orderTotal, received, refunded, saleRefunded: refunded, afterSaleRefunded, settledPaid, netPaid,
    balance: orderTotal === null ? null : Math.max(orderTotal - settledPaid, 0),
    refundDue: facts.status === "cancelled" ? netPaid : facts.status === "in_progress" && orderTotal !== null ? Math.max(settledPaid - orderTotal, 0) : 0,
    paymentState: orderTotal !== null && settledPaid >= orderTotal ? "Paid" as const : "Unpaid" as const,
  };
}

export function isCompletionEligible(facts: OrderFacts): boolean {
  const { settledPaid, orderTotal } = orderTotals(facts);
  return facts.status === "in_progress" && !facts.shippingFeePending && orderTotal !== null && facts.items.length > 0
    && facts.items.every((item) => item.productKind === "grc" || item.releasedCount === item.quantity)
    && facts.deliveryMethod !== null
    && (facts.deliveryMethod !== "courier" || facts.hasShippedShipment)
    && (!facts.items.some((item) => item.productKind === "grc") || (facts.deliveryMethod === "courier" ? facts.hasShippedShipment : facts.hasHandedOver))
    && settledPaid === orderTotal;
}
