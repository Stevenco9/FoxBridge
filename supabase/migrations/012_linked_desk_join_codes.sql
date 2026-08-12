-- Sprint 22.3 — Linked Desktop join codes & Connected Desktops management
-- Principal-issued short-lived join codes → Linked desks (48h).
-- Extends desk_device_audit actions. Does not change Principal claim or phone pairing.

-- ---------------------------------------------------------------------------
-- 1) Expand audit actions for Linked lifecycle
-- ---------------------------------------------------------------------------

ALTER TABLE desk_device_audit
  DROP CONSTRAINT IF EXISTS desk_device_audit_action_check;

ALTER TABLE desk_device_audit
  ADD CONSTRAINT desk_device_audit_action_check CHECK (
    action IN (
      'principal_claimed',
      'principal_transferred',
      'principal_revoked',
      'join_code_issued',
      'join_code_redeemed',
      'linked_desktop_created',
      'linked_desktop_revoked'
    )
  );

COMMENT ON TABLE desk_device_audit IS
  'Desk trust audit (Principal + Linked). Never store registration API keys, raw join codes, or raw desk tokens.';

-- ---------------------------------------------------------------------------
-- 2) Principal-issued Linked Desktop join codes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS desk_join_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  label text,
  issued_by_desk_device_id uuid REFERENCES desk_devices(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_desk_device_id uuid REFERENCES desk_devices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desk_join_codes_conference_idx
  ON desk_join_codes (conference_id);

CREATE INDEX IF NOT EXISTS desk_join_codes_expires_idx
  ON desk_join_codes (expires_at);

ALTER TABLE desk_join_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE desk_join_codes FROM anon, authenticated;
GRANT ALL ON TABLE desk_join_codes TO service_role;

COMMENT ON TABLE desk_join_codes IS
  'Principal-issued one-time Linked Desktop join codes. Store hashed codes only (Sprint 22.3).';

-- ---------------------------------------------------------------------------
-- 3) Issue join code (service_role / Edge Function via RPC)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION issue_desk_join_code(
  p_conference_id uuid,
  p_issued_by_desk_device_id uuid,
  p_ttl_minutes integer DEFAULT 15,
  p_label text DEFAULT NULL
)
RETURNS TABLE (
  join_code_id uuid,
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
  v_issuer_role text;
BEGIN
  IF p_conference_id IS NULL THEN
    RAISE EXCEPTION 'conference_id is required';
  END IF;

  IF p_issued_by_desk_device_id IS NULL THEN
    RAISE EXCEPTION 'issuer desk device is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM conferences c WHERE c.id = p_conference_id) THEN
    RAISE EXCEPTION 'conference not found';
  END IF;

  SELECT d.role INTO v_issuer_role
  FROM desk_devices d
  WHERE d.id = p_issued_by_desk_device_id
    AND d.conference_id = p_conference_id
    AND d.revoked_at IS NULL
    AND (d.expires_at IS NULL OR d.expires_at > now());

  IF v_issuer_role IS DISTINCT FROM 'principal' THEN
    RAISE EXCEPTION 'Only the Principal Desktop can issue join codes';
  END IF;

  -- Linked join codes: 5–30 minutes (default 15).
  v_ttl := GREATEST(5, LEAST(COALESCE(p_ttl_minutes, 15), 30));
  v_expires := now() + make_interval(mins => v_ttl);
  v_raw := upper(substr(encode(gen_random_bytes(9), 'hex'), 1, 12));
  v_raw := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);
  v_hash := encode(digest(v_raw, 'sha256'), 'hex');
  v_id := gen_random_uuid();

  INSERT INTO desk_join_codes (
    id,
    conference_id,
    code_hash,
    label,
    issued_by_desk_device_id,
    expires_at
  )
  VALUES (
    v_id,
    p_conference_id,
    v_hash,
    NULLIF(trim(p_label), ''),
    p_issued_by_desk_device_id,
    v_expires
  );

  INSERT INTO desk_device_audit (conference_id, desk_device_id, action, details)
  VALUES (
    p_conference_id,
    p_issued_by_desk_device_id,
    'join_code_issued',
    jsonb_build_object(
      'join_code_id', v_id,
      'expires_at', v_expires,
      'ttl_minutes', v_ttl
    )
  );

  join_code_id := v_id;
  raw_code := v_raw;
  conference_id := p_conference_id;
  expires_at := v_expires;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION issue_desk_join_code(uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_desk_join_code(uuid, uuid, integer, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Redeem join code → Linked desk (48h), atomic consume
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION redeem_desk_join_code(
  p_code_hash text,
  p_token_hash text,
  p_label text DEFAULT NULL
)
RETURNS TABLE (
  desk_device_id uuid,
  conference_id uuid,
  expires_at timestamptz,
  join_code_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code desk_join_codes%ROWTYPE;
  v_desk_id uuid;
  v_expires timestamptz;
  v_label text;
BEGIN
  IF p_code_hash IS NULL OR length(trim(p_code_hash)) = 0 THEN
    RAISE EXCEPTION 'join code hash is required';
  END IF;

  IF p_token_hash IS NULL OR length(trim(p_token_hash)) = 0 THEN
    RAISE EXCEPTION 'token hash is required';
  END IF;

  SELECT * INTO v_code
  FROM desk_join_codes
  WHERE code_hash = lower(trim(p_code_hash))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOIN_CODE_INVALID';
  END IF;

  IF v_code.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'JOIN_CODE_USED';
  END IF;

  IF v_code.expires_at <= now() THEN
    RAISE EXCEPTION 'JOIN_CODE_EXPIRED';
  END IF;

  v_expires := now() + interval '48 hours';
  v_label := COALESCE(
    NULLIF(trim(p_label), ''),
    NULLIF(trim(v_code.label), ''),
    'Linked Desktop'
  );
  v_desk_id := gen_random_uuid();

  INSERT INTO desk_devices (
    id,
    conference_id,
    token_hash,
    label,
    role,
    expires_at
  )
  VALUES (
    v_desk_id,
    v_code.conference_id,
    lower(trim(p_token_hash)),
    v_label,
    'linked',
    v_expires
  );

  UPDATE desk_join_codes
  SET
    used_at = now(),
    used_by_desk_device_id = v_desk_id
  WHERE id = v_code.id
    AND used_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOIN_CODE_USED';
  END IF;

  INSERT INTO desk_device_audit (conference_id, desk_device_id, action, details)
  VALUES (
    v_code.conference_id,
    v_code.issued_by_desk_device_id,
    'join_code_redeemed',
    jsonb_build_object(
      'join_code_id', v_code.id,
      'linked_desk_device_id', v_desk_id
    )
  );

  INSERT INTO desk_device_audit (conference_id, desk_device_id, action, details)
  VALUES (
    v_code.conference_id,
    v_desk_id,
    'linked_desktop_created',
    jsonb_build_object(
      'expires_at', v_expires,
      'join_code_id', v_code.id
    )
  );

  desk_device_id := v_desk_id;
  conference_id := v_code.conference_id;
  expires_at := v_expires;
  join_code_id := v_code.id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION redeem_desk_join_code(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_desk_join_code(text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Revoke Linked desk (Principal only; never Principal via this RPC)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION revoke_linked_desk_device(
  p_conference_id uuid,
  p_actor_desk_device_id uuid,
  p_target_desk_device_id uuid
)
RETURNS TABLE (
  desk_device_id uuid,
  revoked_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_role text;
  v_target desk_devices%ROWTYPE;
  v_revoked timestamptz;
BEGIN
  SELECT d.role INTO v_actor_role
  FROM desk_devices d
  WHERE d.id = p_actor_desk_device_id
    AND d.conference_id = p_conference_id
    AND d.revoked_at IS NULL
    AND (d.expires_at IS NULL OR d.expires_at > now());

  IF v_actor_role IS DISTINCT FROM 'principal' THEN
    RAISE EXCEPTION 'Only the Principal Desktop can revoke Linked Desktops';
  END IF;

  SELECT * INTO v_target
  FROM desk_devices
  WHERE id = p_target_desk_device_id
    AND conference_id = p_conference_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'desk device not found';
  END IF;

  IF v_target.role IS DISTINCT FROM 'linked' THEN
    RAISE EXCEPTION 'Only Linked Desktops can be revoked with this operation';
  END IF;

  IF v_target.revoked_at IS NOT NULL THEN
    desk_device_id := v_target.id;
    revoked_at := v_target.revoked_at;
    RETURN NEXT;
    RETURN;
  END IF;

  v_revoked := now();
  UPDATE desk_devices
  SET revoked_at = v_revoked
  WHERE id = v_target.id;

  INSERT INTO desk_device_audit (conference_id, desk_device_id, action, details)
  VALUES (
    p_conference_id,
    v_target.id,
    'linked_desktop_revoked',
    jsonb_build_object(
      'revoked_by_desk_device_id', p_actor_desk_device_id
    )
  );

  desk_device_id := v_target.id;
  revoked_at := v_revoked;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION revoke_linked_desk_device(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revoke_linked_desk_device(uuid, uuid, uuid) TO service_role;
