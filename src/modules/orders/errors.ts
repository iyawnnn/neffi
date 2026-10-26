export type OrderErrorCode = "not_found" | "wrong_status" | "invalid_input" | "no_product" | "item_full" | "item_has_cards" | "last_item" | "items_delivered" | "delivery_locked" | "balance_exceeded" | "refund_exceeded" | "already_voided" | "card_unavailable" | "checks_incomplete" | "nothing_reserved" | "wrong_delivery" | "already_released" | "settlement_mismatch";

export class OrderError extends Error {
  constructor(readonly code: OrderErrorCode) {
    super(code);
    this.name = "OrderError";
  }
}
