-- Row-level triggers don't fire on TRUNCATE; add a statement-level guard so
-- audit_events truly cannot be emptied out-of-band.
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_block_mutation();
