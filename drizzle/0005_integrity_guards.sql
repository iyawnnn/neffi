-- Integrity guards (Milestone 2): locked rules that compare a row's old and new values, which CHECK
-- constraints cannot express. Each statement is separated by a statement-breakpoint because the migrator
-- runs one statement per call on PGlite. All guards raise SQLSTATE P0001.
-- Seed resets use TRUNCATE, which these row-level triggers deliberately do not intercept.

-- Cards: the DBC public token is permanent once issued; Released only moves to Retired; Retired is
-- final; a card is retired only after its usable credential is revoked; only a still-blank card may be
-- deleted (everything else is retired, never erased).
CREATE FUNCTION cards_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.state <> 'blank' THEN
      RAISE EXCEPTION 'only blank cards can be deleted; retire the card instead' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.public_token IS NOT NULL AND NEW.public_token IS DISTINCT FROM OLD.public_token THEN
    RAISE EXCEPTION 'a card public token is permanent' USING ERRCODE = 'P0001';
  END IF;
  IF (OLD.state = 'retired' AND NEW.state <> 'retired')
     OR (OLD.state = 'released' AND NEW.state NOT IN ('released', 'retired')) THEN
    RAISE EXCEPTION 'a % card cannot become %', OLD.state, NEW.state USING ERRCODE = 'P0001';
  END IF;
  IF NEW.state = 'retired' AND OLD.state <> 'retired' AND EXISTS (
    SELECT 1 FROM activation_credentials c
    WHERE c.card_id = NEW.id AND c.used_at IS NULL AND c.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'revoke the card''s usable activation credential before retiring it' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER cards_guard BEFORE UPDATE OR DELETE ON cards FOR EACH ROW EXECUTE FUNCTION cards_guard();
--> statement-breakpoint

-- Activation credentials: unused -> used or unused -> revoked, never re-enabled; the lookup value and
-- card never change; credentials are never deleted; a retired card never gets a usable credential.
CREATE FUNCTION activation_credentials_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.used_at IS NULL AND NEW.revoked_at IS NULL
       AND EXISTS (SELECT 1 FROM cards WHERE id = NEW.card_id AND state = 'retired') THEN
      RAISE EXCEPTION 'a retired card cannot get a usable activation credential' USING ERRCODE = 'P0001';
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
--> statement-breakpoint
CREATE TRIGGER activation_credentials_guard BEFORE INSERT OR UPDATE OR DELETE ON activation_credentials
  FOR EACH ROW EXECUTE FUNCTION activation_credentials_guard();
--> statement-breakpoint

-- Financial and activity history is append-only: never deleted, and the recorded facts never rewritten.
-- Trigger arguments name the frozen columns (none = the whole row). Other columns stay updatable, so a later
-- void/correction column (Milestone 8) can be added and set without redesign.
CREATE FUNCTION history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  frozen text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% rows are history and cannot be deleted', TG_TABLE_NAME USING ERRCODE = 'P0001';
  END IF;
  IF TG_NARGS = 0 THEN
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION '% rows are history and cannot be changed', TG_TABLE_NAME USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  FOREACH frozen IN ARRAY TG_ARGV LOOP
    IF to_jsonb(NEW) -> frozen IS DISTINCT FROM to_jsonb(OLD) -> frozen THEN
      RAISE EXCEPTION '%.% is recorded history and cannot be changed', TG_TABLE_NAME, frozen USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER payments_history_guard BEFORE UPDATE OR DELETE ON payments FOR EACH ROW
  EXECUTE FUNCTION history_guard('order_id', 'amount', 'method', 'paid_on', 'recorded_by_account_id', 'created_at');
--> statement-breakpoint
CREATE TRIGGER refunds_history_guard BEFORE UPDATE OR DELETE ON refunds FOR EACH ROW
  EXECUTE FUNCTION history_guard('order_id', 'amount', 'method', 'refunded_on', 'recorded_by_account_id', 'created_at');
--> statement-breakpoint
CREATE TRIGGER activity_events_history_guard BEFORE UPDATE OR DELETE ON activity_events FOR EACH ROW
  EXECUTE FUNCTION history_guard();
--> statement-breakpoint

-- Orders: Completed (written only by the system once fulfillment + zero balance are derived) and
-- Cancelled are final lifecycle states: their timestamps cannot be rewritten and the order cannot be
-- deleted. An In Progress order with no history can still be deleted as a data-entry mistake.
CREATE FUNCTION orders_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'a % order is history and cannot be deleted', OLD.status USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('completed', 'cancelled')
     AND (NEW.status <> OLD.status
          OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
          OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at) THEN
    RAISE EXCEPTION 'order lifecycle state % is final', OLD.status USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER orders_guard BEFORE UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION orders_guard();
