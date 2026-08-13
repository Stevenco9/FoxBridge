-- Sprint 23.5a — FoxBridge Cloud operational check-in (multi-desk).
-- Platform-agnostic: no RegFox credentials; upstream_* fields reserved for
-- Principal-mediated registration-platform reconciliation (23.5b adapters).
-- Deny-by-default RLS: desk-auth Edge Functions only (service_role).

CREATE TABLE IF NOT EXISTS conference_attendee_check_ins (
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  attendee_id text NOT NULL,
  registration_id text NOT NULL,
  checked_in boolean NOT NULL DEFAULT true,
  checked_in_at timestamptz NOT NULL,
  checked_in_by_desk_device_id uuid REFERENCES desk_devices(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'desktop',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Upstream registration-platform reconciliation (adapter-owned in 23.5b).
  upstream_sync_status text NOT NULL DEFAULT 'pending'
    CHECK (upstream_sync_status IN ('pending', 'synced', 'failed', 'not_applicable')),
  upstream_synced_at timestamptz,
  upstream_last_error_code text,
  PRIMARY KEY (conference_id, attendee_id)
);

CREATE INDEX IF NOT EXISTS conference_attendee_check_ins_updated_idx
  ON conference_attendee_check_ins (conference_id, updated_at, attendee_id);

CREATE INDEX IF NOT EXISTS conference_attendee_check_ins_upstream_pending_idx
  ON conference_attendee_check_ins (conference_id, upstream_sync_status)
  WHERE upstream_sync_status IN ('pending', 'failed');

COMMENT ON TABLE conference_attendee_check_ins IS
  'FoxBridge operational check-in authority for live multi-desk events. Separate from registration snapshot.';
COMMENT ON COLUMN conference_attendee_check_ins.upstream_sync_status IS
  'Pending Principal upstream adapter reconciliation (e.g. RegFox in 23.5b). Not operator-facing.';

ALTER TABLE conference_attendee_check_ins ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies — mutate/read only via service_role (Edge).
REVOKE ALL ON TABLE conference_attendee_check_ins FROM anon, authenticated;
GRANT ALL ON TABLE conference_attendee_check_ins TO service_role;

-- Audit table deferred to Sprint 23.5b (keep 23.5a focused on write + converge).
