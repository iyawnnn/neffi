ALTER TABLE "payments" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "voided_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "voided_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_account_id_accounts_id_fk" FOREIGN KEY ("voided_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_voided_by_account_id_accounts_id_fk" FOREIGN KEY ("voided_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_one_active_per_kind" ON "products" USING btree ("kind") WHERE "products"."active";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_void_all_or_none" CHECK (("payments"."voided_at" IS NULL AND "payments"."voided_by_account_id" IS NULL AND "payments"."void_reason" IS NULL) OR ("payments"."voided_at" IS NOT NULL AND "payments"."voided_by_account_id" IS NOT NULL AND "payments"."void_reason" IS NOT NULL AND length(trim("payments"."void_reason")) > 0));--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_void_all_or_none" CHECK (("refunds"."voided_at" IS NULL AND "refunds"."voided_by_account_id" IS NULL AND "refunds"."void_reason" IS NULL) OR ("refunds"."voided_at" IS NOT NULL AND "refunds"."voided_by_account_id" IS NOT NULL AND "refunds"."void_reason" IS NOT NULL AND length(trim("refunds"."void_reason")) > 0));--> statement-breakpoint
CREATE FUNCTION void_once_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.voided_at IS NOT NULL AND (
    NEW.voided_at IS DISTINCT FROM OLD.voided_at
    OR NEW.voided_by_account_id IS DISTINCT FROM OLD.voided_by_account_id
    OR NEW.void_reason IS DISTINCT FROM OLD.void_reason
  ) THEN
    RAISE EXCEPTION 'a void is final' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER payments_void_once_guard BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION void_once_guard();
--> statement-breakpoint
CREATE TRIGGER refunds_void_once_guard BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION void_once_guard();
