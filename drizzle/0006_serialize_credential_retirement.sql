-- Serialize usable-credential issuance with retirement on the card row. The no-op write also
-- forces stale REPEATABLE READ / SERIALIZABLE snapshots to retry without changing audit timestamps.
CREATE OR REPLACE FUNCTION activation_credentials_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_state card_state;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.used_at IS NULL AND NEW.revoked_at IS NULL THEN
      UPDATE cards SET updated_at = updated_at WHERE id = NEW.card_id RETURNING state INTO target_state;
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
