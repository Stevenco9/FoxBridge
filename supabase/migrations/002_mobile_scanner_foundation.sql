-- FoxBridge mobile scanner foundation (Sprint 11)
-- Run after 001_cloud_foundation.sql

CREATE TABLE IF NOT EXISTS scanner_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE INDEX IF NOT EXISTS scanner_sessions_code_idx ON scanner_sessions (code);

ALTER TABLE conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanner_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_conferences ON conferences;
CREATE POLICY anon_read_conferences
  ON conferences
  FOR SELECT
  TO anon
  USING (true);

CREATE OR REPLACE FUNCTION validate_scanner_code(scanner_code text)
RETURNS TABLE (
  session_id uuid,
  conference_id uuid,
  conference_name text,
  label text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ss.id, ss.conference_id, c.name, ss.label
  FROM scanner_sessions ss
  JOIN conferences c ON c.id = ss.conference_id
  WHERE ss.code = scanner_code
    AND ss.revoked_at IS NULL
    AND (ss.expires_at IS NULL OR ss.expires_at > now());
$$;

GRANT EXECUTE ON FUNCTION validate_scanner_code(text) TO anon;

-- Example station code for testing:
-- INSERT INTO scanner_sessions (conference_id, code, label)
-- SELECT id, 'meal-line-1', 'Meal line 1'
-- FROM conferences
-- WHERE slug = 'adagra-2026';
