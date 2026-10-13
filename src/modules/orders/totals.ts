export type ItemFacts = { quantity: number; unitPrice: number; agreedTotal: number | null; activeCount: number; releasedCount: number };
export type OrderFacts = {
  status: "in_progress" | "completed" | "cancelled";
  deliveryMethod: "pickup" | "local_handoff" | "courier" | null;
  shippingFee: number;
  items: ItemFacts[];
  received: number;
  refunded: number;
  hasShippedShipment: boolean;
};

export function effectiveItemTotal(item: Pick<ItemFacts, "quantity" | "unitPrice" | "agreedTotal">): number {
  return item.agreedTotal ?? item.quantity * item.unitPrice;
}

export function orderTotals(facts: OrderFacts) {
  const orderTotal = facts.items.reduce((sum, item) => sum + effectiveItemTotal(item), facts.shippingFee);
  const { received, refunded } = facts;
  const netPaid = received - refunded;
  return {
    orderTotal, received, refunded, netPaid,
    balance: Math.max(orderTotal - netPaid, 0),
    refundDue: facts.status === "cancelled" ? netPaid : facts.status === "in_progress" ? Math.max(netPaid - orderTotal, 0) : 0,
    paymentState: netPaid >= orderTotal ? "Paid" as const : "Unpaid" as const,
  };
}

export function isCompletionEligible(facts: OrderFacts): boolean {
  const { netPaid, orderTotal } = orderTotals(facts);
  return facts.status === "in_progress" && facts.items.length > 0
    && facts.items.every((item) => item.releasedCount === item.quantity)
    && facts.deliveryMethod !== null
    && (facts.deliveryMethod !== "courier" || facts.hasShippedShipment)
    && netPaid === orderTotal;
}
