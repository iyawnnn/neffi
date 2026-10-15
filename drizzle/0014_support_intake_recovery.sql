CREATE TYPE "public"."support_case_source" AS ENUM('owner', 'public', 'account');--> statement-breakpoint
CREATE TABLE "account_recoveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"support_case_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"old_email" text NOT NULL,
	"new_email" text NOT NULL,
	"code_hmac" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"unlink_google" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "account_recoveries_new_email" CHECK ("account_recoveries"."new_email" = lower("account_recoveries"."new_email") AND length("account_recoveries"."new_email") <= 254),
	CONSTRAINT "account_recoveries_code_hmac" CHECK ("account_recoveries"."code_hmac" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "account_recoveries_attempts" CHECK ("account_recoveries"."attempts" BETWEEN 0 AND 3),
	CONSTRAINT "account_recoveries_status" CHECK ("account_recoveries"."status" IN ('pending', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "source" "support_case_source" DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "requester_email" text;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "requester_name" text;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "requester_message" text;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "client_key" uuid;--> statement-breakpoint
ALTER TABLE "account_recoveries" ADD CONSTRAINT "account_recoveries_support_case_id_support_cases_id_fk" FOREIGN KEY ("support_case_id") REFERENCES "public"."support_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_recoveries" ADD CONSTRAINT "account_recoveries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_recoveries" ADD CONSTRAINT "account_recoveries_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_recoveries_pending_account_unique" ON "account_recoveries" USING btree ("account_id") WHERE "account_recoveries"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "account_recoveries_pending_email_unique" ON "account_recoveries" USING btree ("new_email") WHERE "account_recoveries"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "support_cases_client_key_unique" ON "support_cases" USING btree ("client_key") WHERE "support_cases"."client_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "support_cases_source_status_idx" ON "support_cases" USING btree ("source","status");--> statement-breakpoint
CREATE INDEX "support_cases_public_ack_idx" ON "support_cases" USING btree ("requester_email","created_at") WHERE "support_cases"."source" = 'public';--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_public_contact" CHECK ("support_cases"."source" <> 'public' OR ("support_cases"."requester_email" IS NOT NULL AND "support_cases"."opened_by_account_id" IS NULL));--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_requester_email" CHECK ("support_cases"."requester_email" = lower("support_cases"."requester_email") AND length("support_cases"."requester_email") <= 254);--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_requester_name" CHECK (length("support_cases"."requester_name") <= 100);--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_requester_message" CHECK (length("support_cases"."requester_message") <= 2000);
--> statement-breakpoint
CREATE TRIGGER support_cases_intake_guard BEFORE UPDATE ON support_cases FOR EACH ROW
  EXECUTE FUNCTION history_guard('source', 'requester_email', 'requester_name', 'requester_message', 'client_key', 'created_at');
--> statement-breakpoint
CREATE FUNCTION account_recoveries_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'recovery history cannot be deleted' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.status <> 'pending' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'terminal recovery is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.code_hmac IS DISTINCT FROM OLD.code_hmac
     OR NEW.old_email IS DISTINCT FROM OLD.old_email
     OR NEW.new_email IS DISTINCT FROM OLD.new_email
     OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.support_case_id IS DISTINCT FROM OLD.support_case_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'recovery proof and subjects are immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND
     (OLD.status <> 'pending' OR NEW.status NOT IN ('completed', 'cancelled')) THEN
    RAISE EXCEPTION 'invalid recovery transition' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.attempts < OLD.attempts OR (NEW.attempts IS DISTINCT FROM OLD.attempts AND OLD.status <> 'pending') THEN
    RAISE EXCEPTION 'recovery attempts cannot decrease' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER account_recoveries_guard BEFORE UPDATE OR DELETE ON account_recoveries
  FOR EACH ROW EXECUTE FUNCTION account_recoveries_guard();
