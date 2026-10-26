// The one task an owner should do next on a normal (fixed-price DBC) order, derived only from facts already loaded.
// Legacy orders (no client key) keep their historical controls and get no guided task.
type Item = { productKind: "dbc" | "grc"; quantity: number; allocatedCount: number; preparedCount: number; releasedCount: number };
export type NextStepInput = {
  status: "in_progress" | "completed" | "cancelled";
  clientKey: string | null;
  deliveryMethod: "pickup" | "local_handoff" | "courier" | null;
  shippingFeePending: boolean;
  items: Item[];
  cards: { id: string; state: string; ownerAccountId: string | null }[];
  shipment: { recipientName: string | null; recipientContact: string | null; address: string | null } | null;
};

export type NextStep =
  | { key: "legacy" | "cancelled" | "give_card" | "complete_jnt" | "mark_shipped" }
  | { key: "waiting_for_stock"; remaining: number }
  | { key: "prepare_card"; cardId: string; progress: string }
  | { key: "waiting_for_activation" | "activated" };

export function orderNextStep(order: NextStepInput): NextStep {
  if (!order.clientKey) return { key: "legacy" };
  if (order.status === "cancelled") return { key: "cancelled" };
  const dbc = order.items.filter((item) => item.productKind === "dbc");
  const quantity = dbc.reduce((sum, item) => sum + item.quantity, 0);
  const prepared = dbc.reduce((sum, item) => sum + item.preparedCount, 0);
  const allocated = dbc.reduce((sum, item) => sum + item.allocatedCount, 0);

  if (order.status === "completed") {
    const released = order.cards.filter((card) => card.state === "released");
    return { key: released.length && released.every((card) => card.ownerAccountId) ? "activated" : "waiting_for_activation" };
  }
  const preparing = order.cards.find((card) => card.state === "preparing");
  if (preparing) return { key: "prepare_card", cardId: preparing.id, progress: `${prepared} of ${quantity} prepared` };
  if (allocated < quantity) return { key: "waiting_for_stock", remaining: quantity - allocated };
  if (order.deliveryMethod !== "courier") return { key: "give_card" };
  const shipment = order.shipment;
  return { key: shipment?.recipientName?.trim() && shipment.recipientContact?.trim() && shipment.address?.trim() ? "mark_shipped" : "complete_jnt" };
}
