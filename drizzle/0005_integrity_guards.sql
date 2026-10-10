-- Integrity guards (Milestone 2): locked rules that compare a row's old and new values, which CHECK
-- constraints cannot express. Each statement is separated by a statement-breakpoint because the migrator
-- runs one statement per call on PGlite. All guards raise SQLSTATE P0001.
-- Seed resets use TRUNCATE, which these row-level triggers deliberately do not intercept.

-- Cards: the DBC public token is permanent once issued; Released only moves to Retired; Retired is
-- final; only a still-blank card may be deleted (everything else is retired, never erased).
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
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER cards_guard BEFORE UPDATE OR DELETE ON cards FOR EACH ROW EXECUTE FUNCTION cards_guard();
--> statement-breakpoint

-- Activation credentials: unused -> used or unused -> revoked, never re-enabled; the lookup value and
-- card never change; credentials are never deleted.
CREATE FUNCTION activation_credentials_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
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
CREATE TRIGGER activation_credentials_guard BEFORE UPDATE OR DELETE ON activation_credentials
  FOR EACH ROW EXECUTE FUNCTION activation_credentials_guard();
--> statement-breakpoint

-- Financial and activity history is append-only: mistakes are corrected with new records, never erased.
-- Updates stay possible so a later void/correction column can be added without redesign.
CREATE FUNCTION history_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are history and cannot be deleted', TG_TABLE_NAME USING ERRCODE = 'P0001';
END $$;
--> statement-breakpoint
CREATE TRIGGER payments_history_guard BEFORE DELETE ON payments FOR EACH ROW EXECUTE FUNCTION history_guard();
--> statement-breakpoint
CREATE TRIGGER refunds_history_guard BEFORE DELETE ON refunds FOR EACH ROW EXECUTE FUNCTION history_guard();
--> statement-breakpoint
CREATE TRIGGER activity_events_history_guard BEFORE DELETE ON activity_events FOR EACH ROW EXECUTE FUNCTION history_guard();
--> statement-breakpoint

-- Orders: Completed (written only by the system once fulfillment + zero balance are derived) and
-- Cancelled are final lifecycle states; their timestamps cannot be rewritten.
CREATE FUNCTION orders_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('completed', 'cancelled')
     AND (NEW.status <> OLD.status
          OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
          OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at) THEN
    RAISE EXCEPTION 'order lifecycle state % is final', OLD.status USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER orders_guard BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION orders_guard();
