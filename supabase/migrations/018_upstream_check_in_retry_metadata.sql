-- Sprint 23.5b1 — Durable upstream reconciliation retry metadata (platform-neutral).
-- Keeps operational check-in authority unchanged. Enables Principal restart/transfer
-- to distinguish: retry now / retry later / do not auto-retry / synced / not_applicable.
--
-- Why these columns (smallest sufficient set):
--   upstream_sync_status + upstream_last_error_code (017) alone cannot encode
--   "retry after T" or exclude terminal failures from auto-pull after a new Principal unlock.
--   upstream_retry_eligible=false → never auto-pulled (terminal / exhausted / N/A).
--   upstream_next_attempt_at → backoff survives quit/transfer.
--   upstream_attempt_count → deterministic backoff + max attempts without Desktop RAM.
-- upstream_last_attempt_at omitted: updated_at + attempt_count suffice.

ALTER TABLE conference_attendee_check_ins
  ADD COLUMN IF NOT EXISTS upstream_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upstream_next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS upstream_retry_eligible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN conference_attendee_check_ins.upstream_attempt_count IS
  'Principal upstream adapter attempts. Durable across Desktop restart/transfer.';
COMMENT ON COLUMN conference_attendee_check_ins.upstream_next_attempt_at IS
  'When a retryable failure may be auto-retried. NULL = eligible immediately if retry_eligible.';
COMMENT ON COLUMN conference_attendee_check_ins.upstream_retry_eligible IS
  'False for terminal failures, retry_exhausted, or not_applicable. Auto-pull must exclude these.';

CREATE INDEX IF NOT EXISTS conference_attendee_check_ins_upstream_eligible_idx
  ON conference_attendee_check_ins (conference_id, upstream_next_attempt_at)
  WHERE checked_in = true
    AND upstream_retry_eligible = true
    AND upstream_sync_status IN ('pending', 'failed');
