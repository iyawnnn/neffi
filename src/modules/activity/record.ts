import "server-only";
import * as schema from "../../db/schema";
import type { Db } from "../db";

export type ActivityType =
  | "stock_received"
  | "card_provisioned"
  | "card_nfc_verified"
  | "card_ready"
  | "activation_credential_replaced"
  | "card_reserved"
  | "card_retired"
  | "account_role_changed"
  | "order_created"
  | "order_assigned"
  | "order_items_changed"
  | "order_handed_over"
  | "order_completed"
  | "order_cancelled"
  | "payment_recorded"
  | "payment_voided"
  | "refund_recorded"
  | "refund_voided"
  | "card_returned"
  | "shipment_recorded"
  | "shipment_updated"
  | "card_released"
  | "card_claimed"
  | "card_profile_changed"
  | "card_disabled"
  | "card_enabled"
  | "support_case_resolved"
  | "note";

type ActivityInput = {
  type: ActivityType;
  actorAccountId: string;
  cardId?: string;
  accountId?: string;
  orderId?: string;
  stockPurchaseId?: string;
  note?: string;
};

// Call inside the transaction of the action it describes so the event commits or rolls back with it.
// Notes must never contain activation codes or other secrets.
export async function recordActivity(tx: Db, event: ActivityInput): Promise<void> {
  await tx.insert(schema.activityEvents).values(event);
}
