// Owner-facing inventory vocabulary, derived from persisted facts only (never from the intended delivery method).
// The SQL in queries.ts (`CARD_STATUS_KEY_SQL`) encodes the same priority; the db tests keep the two in step.
export type InventoryOperationFacts = {
  id: string; kind?: "dbc" | "grc" | null; state: "blank" | "preparing" | "ready" | "reserved" | "released" | "retired";
  publicToken: string | null; ownerAccountId: string | null; orderId: string | null;
  deliveryMethod: "pickup" | "local_handoff" | "courier" | null;
  hasShippedShipment: boolean; hasHandedOver: boolean;
};

export type InventoryStatus = "Available blank" | "Needs preparation" | "Ready" | "Assigned" | "Shipped" | "Given to customer" | "Waiting for activation" | "Delivery to verify" | "Activated" | "Retired";

export type StatusKey = "available_blank" | "needs_preparation" | "ready" | "assigned" | "shipped" | "given" | "waiting_activation" | "delivery_unconfirmed" | "activated" | "retired";
export const STATUS_LABEL_BY_KEY: Record<StatusKey, InventoryStatus> = {
  available_blank: "Available blank", needs_preparation: "Needs preparation", ready: "Ready", assigned: "Assigned", shipped: "Shipped",
  given: "Given to customer", waiting_activation: "Waiting for activation", activated: "Activated", retired: "Retired",
  delivery_unconfirmed: "Delivery to verify",
};

export const inventoryReference = (number: number) => `N-${String(number).padStart(4, "0")}`;

export function toInventoryOperation(card: InventoryOperationFacts): { status: InventoryStatus; actionLabel: string; href: string } {
  const cardHref = `/admin/inventory/cards/${card.id}`;
  const orderHref = card.orderId ? `/admin/orders/${card.orderId}` : cardHref;
  if (card.state === "retired") return { status: "Retired", actionLabel: "View history", href: cardHref };
  if (card.state === "released") {
    if (card.ownerAccountId && card.kind !== "grc") return { status: "Activated", actionLabel: "View card", href: cardHref };
    if (card.hasShippedShipment) return { status: "Shipped", actionLabel: "View shipment", href: orderHref };
    if (card.hasHandedOver) return { status: "Given to customer", actionLabel: "View order", href: orderHref };
    return card.kind === "grc" ? { status: "Delivery to verify", actionLabel: "Check order", href: orderHref } : { status: "Waiting for activation", actionLabel: "View order", href: orderHref };
  }
  if (card.state === "reserved") return { status: "Assigned", actionLabel: card.deliveryMethod === "courier" ? "Mark as shipped" : "Give card to customer", href: orderHref };
  if (card.state === "preparing" || (card.state === "blank" && card.publicToken)) return { status: "Needs preparation", actionLabel: "Prepare card", href: cardHref };
  if (card.state === "ready") return { status: "Ready", actionLabel: "View preparation", href: cardHref };
  return { status: "Available blank", actionLabel: "Create order", href: "/admin/orders/new" };
}

// What the Activation column may say about a credential without ever touching its code.
export function activationCell(input: { kind?: "dbc" | "grc" | null; ownerAccountId: string | null; usableCredential: boolean; retrievable: boolean; revoked: boolean; retired: boolean }): { label: string; href: boolean } {
  if (input.kind === "grc") return { label: "Not applicable", href: false };
  if (input.ownerAccountId) return { label: "Activated", href: false };
  if (input.retired) return { label: input.revoked || input.usableCredential ? "Revoked" : "Not issued", href: false };
  if (input.usableCredential) return input.retrievable ? { label: "Show code", href: true } : { label: "Existing package code needed", href: true };
  return input.revoked ? { label: "Replaced or revoked", href: false } : { label: "Not issued", href: false };
}
