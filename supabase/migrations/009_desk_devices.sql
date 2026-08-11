-- Sprint 21.6 — FoxBridge Cloud desk enrollment & event-scoped desk devices
-- Privileged Desktop ops move behind Edge Functions that verify desk tokens
-- with the service role held only in Cloud. Do not weaken anon RLS for writes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Long-lived (but revocable) Desktop credentials, bound to one conference.
CREATE TABLE IF NOT EXISTS desk_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS desk_devices_conference_idx
  ON desk_devices (conference_id);

CREATE INDEX IF NOT EXISTS desk_devices_token_hash_idx
  ON desk_devices (token_hash);

-- One-time, short-lived enrollment codes issued by FoxBridge Cloud operators.
CREATE TABLE IF NOT EXISTS desk_enrollment_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  label text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_desk_device_id uuid REFERENCES desk_devices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desk_enrollment_codes_conference_idx
  ON desk_enrollment_codes (conference_id);

CREATE INDEX IF NOT EXISTS desk_enrollment_codes_expires_idx
  ON desk_enrollment_codes (expires_at);

ALTER TABLE desk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk_enrollment_codes ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: mutate/read only via service_role (Edge Functions).
REVOKE ALL ON TABLE desk_devices FROM anon, authenticated;
REVOKE ALL ON TABLE desk_enrollment_codes FROM anon, authenticated;
GRANT ALL ON TABLE desk_devices TO service_role;
GRANT ALL ON TABLE desk_enrollment_codes TO service_role;

-- Operator helper (service_role / SQL editor only). Returns the raw code once.
CREATE OR REPLACE FUNCTION issue_desk_enrollment_code(
  p_conference_id uuid,
  p_ttl_minutes integer DEFAULT 60,
  p_label text DEFAULT NULL
)
RETURNS TABLE (
  enrollment_id uuid,
  raw_code text,
  conference_id uuid,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_hash text;
  v_id uuid;
  v_expires timestamptz;
  v_ttl integer;
BEGIN
  IF p_conference_id IS NULL THEN
    RAISE EXCEPTION 'conference_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM conferences c WHERE c.id = p_conference_id) THEN
    RAISE EXCEPTION 'conference not found';
  END IF;

  v_ttl := GREATEST(5, LEAST(COALESCE(p_ttl_minutes, 60), 24 * 60));
  v_expires := now() + make_interval(mins => v_ttl);
  -- Human-enterable code; only the hash is stored.
  v_raw := upper(substr(encode(gen_random_bytes(9), 'hex'), 1, 12));
  v_raw := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);
  v_hash := encode(digest(v_raw, 'sha256'), 'hex');
  v_id := gen_random_uuid();

  INSERT INTO desk_enrollment_codes (id, conference_id, code_hash, label, expires_at)
  VALUES (v_id, p_conference_id, v_hash, NULLIF(trim(p_label), ''), v_expires);

  enrollment_id := v_id;
  raw_code := v_raw;
  conference_id := p_conference_id;
  expires_at := v_expires;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION issue_desk_enrollment_code(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION issue_desk_enrollment_code(uuid, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION issue_desk_enrollment_code(uuid, integer, text) TO service_role;

COMMENT ON TABLE desk_devices IS
  'Event-scoped Desktop credentials for FoxBridge Cloud ops (Sprint 21.6). Token hashes only.';
COMMENT ON TABLE desk_enrollment_codes IS
  'Single-use short-lived codes exchanged for desk_devices via Edge Function desktop-enroll.';
COMMENT ON FUNCTION issue_desk_enrollment_code(uuid, integer, text) IS
  'Operator-only: create an enrollment code for a conference. Call as service_role.';
