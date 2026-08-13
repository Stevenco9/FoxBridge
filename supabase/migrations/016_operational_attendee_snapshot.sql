-- Sprint 23.4a — Principal-published operational attendee snapshot for Linked parity.
-- Desk-auth Edge paths only; do not broaden anon RLS in this migration.

ALTER TABLE attendees
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS organization text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS confirmation_code text,
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS payment_total numeric,
  ADD COLUMN IF NOT EXISTS payment_paid numeric,
  ADD COLUMN IF NOT EXISTS payment_balance numeric,
  ADD COLUMN IF NOT EXISTS payment_currency text,
  ADD COLUMN IF NOT EXISTS payment_upstream_status text,
  ADD COLUMN IF NOT EXISTS checked_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS operational_json jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN attendees.snapshot_version IS
  'FoxBridge operational snapshot contract version (v1 = Sprint 23.4a).';
COMMENT ON COLUMN attendees.operational_json IS
  'Sanitized FoxBridge Attendee fields (purchases, customFields, names). Never raw RegFox.';
COMMENT ON COLUMN attendees.checked_in IS
  'Principal-published check-in DISPLAY state. Linked write-through is Sprint 23.5.';
