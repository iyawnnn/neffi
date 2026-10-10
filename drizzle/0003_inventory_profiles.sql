CREATE TYPE "public"."card_state" AS ENUM('blank', 'ready', 'reserved', 'released', 'retired');--> statement-breakpoint
CREATE TYPE "public"."profile_link_type" AS ENUM('facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'github', 'messenger', 'whatsapp', 'viber', 'telegram', 'x', 'portfolio', 'booking', 'shop', 'menu', 'custom');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('draft', 'published', 'unpublished');--> statement-breakpoint
CREATE TABLE "profile_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"type" "profile_link_type" NOT NULL,
	"label" text,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_links_position_nonnegative" CHECK ("profile_links"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"status" "profile_status" DEFAULT 'draft' NOT NULL,
	"full_name" text,
	"headline" text,
	"company" text,
	"bio" text,
	"phone" text,
	"email" text,
	"website" text,
	"location" text,
	"theme" text DEFAULT 'default' NOT NULL,
	"accent_color" text,
	"image_asset_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "profiles_published_needs_name" CHECK ("profiles"."status" <> 'published' OR "profiles"."full_name" IS NOT NULL),
	CONSTRAINT "profiles_accent_color_hex" CHECK ("profiles"."accent_color" IS NULL OR "profiles"."accent_color" ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
CREATE TABLE "activation_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"card_kind" "product_kind" DEFAULT 'dbc' NOT NULL,
	"lookup_hmac" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "activation_credentials_lookup_hmac_unique" UNIQUE("lookup_hmac"),
	CONSTRAINT "activation_credentials_dbc_only" CHECK ("activation_credentials"."card_kind" = 'dbc'),
	CONSTRAINT "activation_credentials_lookup_hmac_format" CHECK ("activation_credentials"."lookup_hmac" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "activation_credentials_single_outcome" CHECK ("activation_credentials"."used_at" IS NULL OR "activation_credentials"."revoked_at" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_purchase_id" uuid NOT NULL,
	"product_id" uuid,
	"kind" "product_kind",
	"state" "card_state" DEFAULT 'blank' NOT NULL,
	"order_item_id" uuid,
	"public_token" text,
	"owner_account_id" uuid,
	"profile_id" uuid,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "cards_id_kind_unique" UNIQUE("id","kind"),
	CONSTRAINT "cards_product_kind_together" CHECK (("cards"."product_id" IS NULL) = ("cards"."kind" IS NULL)),
	CONSTRAINT "cards_dbc_only_fields" CHECK (COALESCE("cards"."kind" = 'dbc', false) OR ("cards"."public_token" IS NULL AND "cards"."owner_account_id" IS NULL AND "cards"."profile_id" IS NULL AND "cards"."disabled_at" IS NULL)),
	CONSTRAINT "cards_committed_states_need_product" CHECK ("cards"."state" IN ('blank', 'retired') OR "cards"."product_id" IS NOT NULL),
	CONSTRAINT "cards_grc_never_ready" CHECK (NOT COALESCE("cards"."kind" = 'grc' AND "cards"."state" = 'ready', false)),
	CONSTRAINT "cards_dbc_token_when_provisioned" CHECK ("cards"."kind" IS DISTINCT FROM 'dbc' OR "cards"."state" IN ('blank', 'retired') OR "cards"."public_token" IS NOT NULL),
	CONSTRAINT "cards_fulfillment_needs_order_item" CHECK ("cards"."state" NOT IN ('reserved', 'released') OR "cards"."order_item_id" IS NOT NULL),
	CONSTRAINT "cards_stock_has_no_order_item" CHECK ("cards"."state" NOT IN ('blank', 'ready') OR "cards"."order_item_id" IS NULL),
	CONSTRAINT "cards_order_item_needs_product" CHECK ("cards"."order_item_id" IS NULL OR "cards"."product_id" IS NOT NULL),
	CONSTRAINT "cards_profile_needs_owner" CHECK ("cards"."profile_id" IS NULL OR "cards"."owner_account_id" IS NOT NULL),
	CONSTRAINT "cards_disabled_needs_owner" CHECK ("cards"."disabled_at" IS NULL OR "cards"."owner_account_id" IS NOT NULL),
	CONSTRAINT "cards_owner_only_after_sale" CHECK ("cards"."owner_account_id" IS NULL OR "cards"."state" IN ('released', 'retired')),
	CONSTRAINT "cards_retired_routes_nowhere" CHECK ("cards"."state" <> 'retired' OR "cards"."profile_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "stock_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier" text,
	"received_on" date NOT NULL,
	"purchase_cost" integer,
	"inbound_shipping_cost" integer,
	"reference" text,
	"notes" text,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_purchases_purchase_cost_nonnegative" CHECK ("stock_purchases"."purchase_cost" IS NULL OR "stock_purchases"."purchase_cost" >= 0),
	CONSTRAINT "stock_purchases_inbound_shipping_cost_nonnegative" CHECK ("stock_purchases"."inbound_shipping_cost" IS NULL OR "stock_purchases"."inbound_shipping_cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "profile_links" ADD CONSTRAINT "profile_links_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_credentials" ADD CONSTRAINT "activation_credentials_card_fk" FOREIGN KEY ("card_id","card_kind") REFERENCES "public"."cards"("id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_stock_purchase_id_stock_purchases_id_fk" FOREIGN KEY ("stock_purchase_id") REFERENCES "public"."stock_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_owner_account_id_accounts_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_product_fk" FOREIGN KEY ("product_id","kind") REFERENCES "public"."products"("id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_order_item_fk" FOREIGN KEY ("order_item_id","product_id") REFERENCES "public"."order_items"("id","product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_profile_owner_fk" FOREIGN KEY ("profile_id","owner_account_id") REFERENCES "public"."profiles"("id","account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_purchases" ADD CONSTRAINT "stock_purchases_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_links_profile_id_position_idx" ON "profile_links" USING btree ("profile_id","position");--> statement-breakpoint
CREATE INDEX "profiles_account_id_idx" ON "profiles" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activation_credentials_one_usable_per_card" ON "activation_credentials" USING btree ("card_id") WHERE "activation_credentials"."used_at" IS NULL AND "activation_credentials"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "cards_owner_account_id_idx" ON "cards" USING btree ("owner_account_id") WHERE "cards"."owner_account_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "cards_profile_id_idx" ON "cards" USING btree ("profile_id") WHERE "cards"."profile_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "cards_kind_state_idx" ON "cards" USING btree ("kind","state");--> statement-breakpoint
CREATE INDEX "cards_order_item_id_idx" ON "cards" USING btree ("order_item_id") WHERE "cards"."order_item_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "cards_stock_purchase_id_idx" ON "cards" USING btree ("stock_purchase_id");