ALTER TABLE "activation_credentials" ADD COLUMN "encrypted_code" text;--> statement-breakpoint
ALTER TABLE "activity_events" ADD COLUMN "activation_credential_id" uuid;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_activation_credential_id_activation_credentials_id_fk" FOREIGN KEY ("activation_credential_id") REFERENCES "public"."activation_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_activation_credential_id_idx" ON "activity_events" USING btree ("activation_credential_id") WHERE "activity_events"."activation_credential_id" IS NOT NULL;--> statement-breakpoint
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
    ELSE
      NEW.encrypted_code := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'activation credentials are history and cannot be deleted' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.used_at IS NOT NULL OR OLD.revoked_at IS NOT NULL THEN
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION 'activation credential history is immutable' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.card_id IS DISTINCT FROM OLD.card_id
     OR NEW.card_kind IS DISTINCT FROM OLD.card_kind
     OR NEW.lookup_hmac IS DISTINCT FROM OLD.lookup_hmac
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'activation credential history is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.used_at IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
    NEW.encrypted_code := NULL;
  ELSIF OLD.encrypted_code IS NOT NULL AND NEW.encrypted_code IS DISTINCT FROM OLD.encrypted_code THEN
    RAISE EXCEPTION 'a usable activation credential envelope cannot be rewritten' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
