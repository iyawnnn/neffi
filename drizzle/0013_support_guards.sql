ALTER TABLE "refunds" ADD CONSTRAINT "refunds_support_reason" CHECK ("refunds"."support_case_id" IS NULL OR ("refunds"."reason" IS NOT NULL AND length(trim("refunds"."reason")) > 0));
--> statement-breakpoint
DROP TRIGGER refunds_history_guard ON refunds;
--> statement-breakpoint
CREATE TRIGGER refunds_history_guard BEFORE UPDATE OR DELETE ON refunds FOR EACH ROW
  EXECUTE FUNCTION history_guard('order_id', 'amount', 'method', 'refunded_on', 'recorded_by_account_id', 'created_at', 'support_case_id');
--> statement-breakpoint
CREATE TRIGGER support_case_cards_history_guard BEFORE UPDATE OR DELETE ON support_case_cards FOR EACH ROW
  EXECUTE FUNCTION history_guard('support_case_id', 'card_id', 'role', 'created_at');
