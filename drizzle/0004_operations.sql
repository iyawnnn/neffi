CREATE TYPE "public"."expense_category" AS ENUM('inventory_production', 'shipping_delivery', 'packaging_printing', 'software_operations', 'marketing', 'other');--> statement-breakpoint
CREATE TYPE "public"."support_case_card_role" AS ENUM('affected', 'replacement');--> statement-breakpoint
CREATE TYPE "public"."support_case_status" AS ENUM('open', 'waiting_on_customer', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."support_case_type" AS ENUM('activation_issue', 'account_recovery', 'ownership_correction', 'defective_card', 'shipping_issue', 'replacement', 'other');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"actor_account_id" uuid,
	"order_id" uuid,
	"card_id" uuid,
	"account_id" uuid,
	"support_case_id" uuid,
	"stock_purchase_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_events_has_subject" CHECK (num_nonnulls("activity_events"."order_id", "activity_events"."card_id", "activity_events"."account_id", "activity_events"."support_case_id", "activity_events"."stock_purchase_id") >= 1)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spent_on" date NOT NULL,
	"amount" integer NOT NULL,
	"category" "expense_category" NOT NULL,
	"payee" text,
	"note" text,
	"order_id" uuid,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "support_case_cards" (
	"support_case_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"role" "support_case_card_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_case_cards_support_case_id_card_id_pk" PRIMARY KEY("support_case_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "support_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "support_case_type" NOT NULL,
	"status" "support_case_status" DEFAULT 'open' NOT NULL,
	"summary" text NOT NULL,
	"purchaser_id" uuid,
	"account_id" uuid,
	"order_id" uuid,
	"assigned_to_account_id" uuid,
	"opened_by_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "support_cases_resolved_at_matches_status" CHECK (("support_cases"."status" = 'resolved') = ("support_cases"."resolved_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "support_case_id" uuid;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "support_case_id" uuid;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_support_case_id_support_cases_id_fk" FOREIGN KEY ("support_case_id") REFERENCES "public"."support_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_stock_purchase_id_stock_purchases_id_fk" FOREIGN KEY ("stock_purchase_id") REFERENCES "public"."stock_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_cards" ADD CONSTRAINT "support_case_cards_support_case_id_support_cases_id_fk" FOREIGN KEY ("support_case_id") REFERENCES "public"."support_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_case_cards" ADD CONSTRAINT "support_case_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_purchaser_id_purchasers_id_fk" FOREIGN KEY ("purchaser_id") REFERENCES "public"."purchasers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_assigned_to_account_id_accounts_id_fk" FOREIGN KEY ("assigned_to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_opened_by_account_id_accounts_id_fk" FOREIGN KEY ("opened_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_order_id_idx" ON "activity_events" USING btree ("order_id","created_at") WHERE "activity_events"."order_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "activity_events_card_id_idx" ON "activity_events" USING btree ("card_id","created_at") WHERE "activity_events"."card_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "activity_events_account_id_idx" ON "activity_events" USING btree ("account_id","created_at") WHERE "activity_events"."account_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "activity_events_support_case_id_idx" ON "activity_events" USING btree ("support_case_id","created_at") WHERE "activity_events"."support_case_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "activity_events_created_at_idx" ON "activity_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "expenses_spent_on_idx" ON "expenses" USING btree ("spent_on");--> statement-breakpoint
CREATE INDEX "expenses_order_id_idx" ON "expenses" USING btree ("order_id") WHERE "expenses"."order_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "support_case_cards_card_id_idx" ON "support_case_cards" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "support_cases_open_idx" ON "support_cases" USING btree ("status","created_at") WHERE "support_cases"."status" <> 'resolved';--> statement-breakpoint
CREATE INDEX "support_cases_order_id_idx" ON "support_cases" USING btree ("order_id") WHERE "support_cases"."order_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "support_cases_account_id_idx" ON "support_cases" USING btree ("account_id") WHERE "support_cases"."account_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "support_cases_purchaser_id_idx" ON "support_cases" USING btree ("purchaser_id") WHERE "support_cases"."purchaser_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_support_case_id_support_cases_id_fk" FOREIGN KEY ("support_case_id") REFERENCES "public"."support_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_support_case_id_support_cases_id_fk" FOREIGN KEY ("support_case_id") REFERENCES "public"."support_cases"("id") ON DELETE no action ON UPDATE no action;