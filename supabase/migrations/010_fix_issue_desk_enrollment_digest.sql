-- Fix issue_desk_enrollment_code: pgcrypto digest()/gen_random_bytes() live in
-- extensions on hosted Supabase. With search_path = public only, the operator RPC
-- fails with: function digest(text, unknown) does not exist
-- (same class of failure fixed for pairing in 008_fix_pairing_token_digest.sql).
--
-- Sprint 21.9 — narrowly scoped deployment unblocker. No schema redesign.

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
SET search_path = public, extensions
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

COMMENT ON FUNCTION issue_desk_enrollment_code(uuid, integer, text) IS
  'Operator-only: create an enrollment code for a conference. Call as service_role. search_path includes extensions for pgcrypto (Sprint 21.9).';
