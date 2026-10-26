ALTER TABLE "cards" DROP CONSTRAINT "cards_fulfillment_needs_order_item";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_fee_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "client_key" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "normal_payment_method" "payment_method";--> statement-breakpoint
CREATE SEQUENCE "cards_inventory_number_seq" AS integer;--> statement-breakpoint
LOCK TABLE "cards" IN ACCESS EXCLUSIVE MODE;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "inventory_number" integer;--> statement-breakpoint
ALTER SEQUENCE "cards_inventory_number_seq" OWNED BY "cards"."inventory_number";--> statement-breakpoint
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS number FROM cards
)
UPDATE cards SET inventory_number = numbered.number FROM numbered WHERE cards.id = numbered.id;--> statement-breakpoint
SELECT setval('cards_inventory_number_seq', COALESCE((SELECT max(inventory_number) FROM cards), 1), EXISTS (SELECT 1 FROM cards));--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "inventory_number" SET DEFAULT nextval('cards_inventory_number_seq'::regclass);--> statement-breakpoint
ALTER TABLE "cards" ALTER COLUMN "inventory_number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_client_key_unique" ON "orders" USING btree ("client_key") WHERE "orders"."client_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_inventory_number_unique" UNIQUE("inventory_number");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_fee_pending_valid" CHECK (NOT "orders"."shipping_fee_pending" OR (COALESCE("orders"."delivery_method" = 'courier', false) AND "orders"."shipping_fee" = 0));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_completed_fee_confirmed" CHECK ("orders"."status" <> 'completed' OR NOT "orders"."shipping_fee_pending");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_normal_payment_method_required" CHECK ("orders"."client_key" IS NULL OR ("orders"."normal_payment_method" IS NOT NULL AND "orders"."normal_payment_method"::text IN ('gcash', 'maya', 'maribank', 'gotyme', 'bank_transfer')));--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_inventory_number_positive" CHECK ("cards"."inventory_number" > 0);--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_preparing_dbc" CHECK ("cards"."state"::text <> 'preparing' OR (COALESCE("cards"."kind" = 'dbc', false) AND "cards"."product_id" IS NOT NULL AND "cards"."order_item_id" IS NOT NULL AND "cards"."public_token" IS NOT NULL AND "cards"."owner_account_id" IS NULL));--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_fulfillment_needs_order_item" CHECK (("cards"."state" NOT IN ('reserved', 'released') AND "cards"."state"::text <> 'preparing') OR "cards"."order_item_id" IS NOT NULL);--> statement-breakpoint
CREATE OR REPLACE FUNCTION cards_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state::text = 'preparing' THEN
      RAISE EXCEPTION 'Preparing requires an existing card with a usable activation credential' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.state <> 'blank' THEN
      RAISE EXCEPTION 'only blank cards can be deleted; retire the card instead' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.inventory_number IS DISTINCT FROM OLD.inventory_number THEN
    RAISE EXCEPTION 'a card inventory number is permanent' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.public_token IS NOT NULL AND NEW.public_token IS DISTINCT FROM OLD.public_token THEN
    RAISE EXCEPTION 'a card public token is permanent' USING ERRCODE = 'P0001';
  END IF;
  IF (OLD.state = 'retired' AND NEW.state <> 'retired')
     OR (OLD.state = 'released' AND NEW.state NOT IN ('released', 'retired')) THEN
    RAISE EXCEPTION 'a % card cannot become %', OLD.state, NEW.state USING ERRCODE = 'P0001';
  END IF;
  IF NEW.state::text = 'preparing' AND OLD.state::text <> 'preparing'
     AND NOT EXISTS (SELECT 1 FROM activation_credentials c WHERE c.card_id = NEW.id AND c.used_at IS NULL AND c.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Preparing requires a usable activation credential' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.state::text = 'preparing' AND NEW.state = 'reserved'
     AND (NEW.nfc_verified_at IS NULL OR NEW.package_matched_at IS NULL
       OR NOT EXISTS (SELECT 1 FROM activation_credentials c WHERE c.card_id = NEW.id AND c.used_at IS NULL AND c.revoked_at IS NULL)) THEN
    RAISE EXCEPTION 'prepare and match the card before assigning it' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.state = 'retired' AND OLD.state <> 'retired' AND EXISTS (
    SELECT 1 FROM activation_credentials c WHERE c.card_id = NEW.id AND c.used_at IS NULL AND c.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'revoke the card''s usable activation credential before retiring it' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER cards_guard ON cards;--> statement-breakpoint
CREATE TRIGGER cards_guard BEFORE INSERT OR UPDATE OR DELETE ON cards FOR EACH ROW EXECUTE FUNCTION cards_guard();--> statement-breakpoint
CREATE OR REPLACE FUNCTION orders_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'a % order is history and cannot be deleted', OLD.status USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.client_key IS DISTINCT FROM OLD.client_key OR NEW.normal_payment_method IS DISTINCT FROM OLD.normal_payment_method THEN
    RAISE EXCEPTION 'a normal order payment choice and client key are permanent' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.status IN ('completed', 'cancelled')
     AND (NEW.status <> OLD.status OR NEW.completed_at IS DISTINCT FROM OLD.completed_at OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at) THEN
    RAISE EXCEPTION 'order lifecycle state % is final', OLD.status USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
