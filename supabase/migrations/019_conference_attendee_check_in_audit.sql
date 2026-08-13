-- Sprint 23.5b2 — Append-only operational / upstream check-in audit (platform-neutral).
-- Desk-auth Edge writes only; deny-by-default RLS. No PII / secrets / tokens.

CREATE TABLE IF NOT EXISTS conference_attendee_check_in_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  attendee_id text NOT NULL,
  action text NOT NULL,
  desk_device_id uuid REFERENCES desk_devices(id) ON DELETE SET NULL,
  platform_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT conference_attendee_check_in_audit_action_check CHECK (
    action IN (
      'attendee_checked_in',
      'attendee_check_in_duplicate',
      'upstream_check_in_synced',
      'upstream_check_in_failed'
    )
  )
);

CREATE INDEX IF NOT EXISTS conference_attendee_check_in_audit_conference_created_idx
  ON conference_attendee_check_in_audit (conference_id, created_at DESC);

COMMENT ON TABLE conference_attendee_check_in_audit IS
  'Append-only check-in / upstream reconciliation audit. Identifiers only; never secrets or PII.';

ALTER TABLE conference_attendee_check_in_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE conference_attendee_check_in_audit FROM anon, authenticated;
GRANT ALL ON TABLE conference_attendee_check_in_audit TO service_role;
