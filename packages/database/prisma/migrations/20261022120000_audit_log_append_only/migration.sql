-- The audit log is evidence: entries are added, never changed or removed.
--
-- Every UPDATE or DELETE on a row is refused, whatever code sends it (the app, a script,
-- a console session). TRUNCATE (emptying the whole table) is still possible for the
-- database owner: tests and a deliberate re-seed use it. Running the app as a database
-- role that does not own the tables, so it cannot drop this trigger, is part of the
-- production setup.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update_or_delete
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
