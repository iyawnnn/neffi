import "server-only";

export type SupportErrorCode = "not_found" | "invalid_input" | "case_resolved" | "link_exists" | "order_required" | "wrong_order" | "wrong_status" | "card_unavailable" | "card_claimed" | "card_unclaimed" | "card_not_linked" | "replacement_unavailable" | "checks_incomplete" | "recipient_missing" | "activation_code_in_email" | "recovery_pending";

export class SupportError extends Error {
  constructor(readonly code: SupportErrorCode) {
    super(code);
    this.name = "SupportError";
  }
}
