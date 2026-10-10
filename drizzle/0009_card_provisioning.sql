ALTER TABLE "cards" ADD COLUMN "nfc_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "package_matched_at" timestamp with time zone;--> statement-breakpoint
-- NOT VALID: rows that predate recorded provisioning checks (the pre-M4 development seed) carry no physical
-- evidence and must not be backfilled with invented timestamps. Every inserted or updated row is still checked;
-- a database migrated from zero has no legacy rows. Milestone 10 runs VALIDATE CONSTRAINT.
ALTER TABLE "cards" ADD CONSTRAINT "cards_dbc_ready_checks_recorded" CHECK ("cards"."kind" IS DISTINCT FROM 'dbc' OR "cards"."state" <> 'ready' OR ("cards"."nfc_verified_at" IS NOT NULL AND "cards"."package_matched_at" IS NOT NULL)) NOT VALID;--> statement-breakpoint
-- Issuing a usable credential still serializes with retirement on the card row (0006), and now also voids the
-- earlier package match: the packaged code no longer corresponds to the card's usable credential. The write
-- leaves updated_at alone. On a Ready DBC the CHECK above then rejects the insert, so callers demote first.
CREATE OR REPLACE FUNCTION activation_credentials_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_state card_state;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.used_at IS NULL AND NEW.revoked_at IS NULL THEN
      UPDATE cards SET package_matched_at = NULL WHERE id = NEW.card_id RETURNING state INTO target_state;
      IF target_state = 'retired' THEN
        RAISE EXCEPTION 'a retired card cannot get a usable activation credential' USING ERRCODE = 'P0001';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'activation credentials are history and cannot be deleted' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.card_id <> OLD.card_id
     OR NEW.lookup_hmac <> OLD.lookup_hmac
     OR (OLD.used_at IS NOT NULL AND NEW.used_at IS DISTINCT FROM OLD.used_at)
     OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
    RAISE EXCEPTION 'activation credential history is immutable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
