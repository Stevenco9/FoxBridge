-- Sprint 22.5 — Linked Desktop installation identity + join rejoin
-- Opaque installation_id is identity only (not authentication).
-- Rejoin after revoke/expiry requires a fresh valid join code and issues a new token_hash.

ALTER TABLE desk_devices
  ADD COLUMN IF NOT EXISTS installation_id text;

COMMENT ON COLUMN desk_devices.installation_id IS
  'Opaque per-installation UUID from Desktop (Linked). Identity only — never an auth credential.';

-- One Linked desk row per Event + installation (including revoked), so rejoin reactivates.
CREATE UNIQUE INDEX IF NOT EXISTS desk_devices_conference_installation_linked_uidx
  ON desk_devices (conference_id, installation_id)
  WHERE role = 'linked' AND installation_id IS NOT NULL;

-- Replace redeem to accept optional installation_id and reactivate in place.
DROP FUNCTION IF EXISTS redeem_desk_join_code(text, text, text);

CREATE OR REPLACE FUNCTION redeem_desk_join_code(
  p_code_hash text,
  p_token_hash text,
  p_label text DEFAULT NULL,
  p_installation_id text DEFAULT NULL
)
RETURNS TABLE (
  desk_device_id uuid,
  conference_id uuid,
  expires_at timestamptz,
  join_code_id uuid,
  rejoined boolean
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
  v_installation text;
  v_existing desk_devices%ROWTYPE;
  v_rejoined boolean := false;
  v_has_existing boolean := false;
BEGIN
  IF p_code_hash IS NULL OR length(trim(p_code_hash)) = 0 THEN
    RAISE EXCEPTION 'join code hash is required';
  END IF;

  IF p_token_hash IS NULL OR length(trim(p_token_hash)) = 0 THEN
    RAISE EXCEPTION 'token hash is required';
  END IF;

  v_installation := NULLIF(lower(trim(p_installation_id)), '');

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

  IF v_installation IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM desk_devices
    WHERE conference_id = v_code.conference_id
      AND role = 'linked'
      AND installation_id = v_installation
    FOR UPDATE;

    v_has_existing := FOUND;
  END IF;

  IF v_has_existing THEN
    UPDATE desk_devices
    SET
      token_hash = lower(trim(p_token_hash)),
      label = v_label,
      expires_at = v_expires,
      revoked_at = NULL,
      last_used_at = now()
    WHERE id = v_existing.id;

    v_desk_id := v_existing.id;
    v_rejoined := true;

    INSERT INTO desk_device_audit (conference_id, desk_device_id, action, details)
    VALUES (
      v_code.conference_id,
      v_desk_id,
      'linked_desktop_rejoined',
      jsonb_build_object(
        'expires_at', v_expires,
        'join_code_id', v_code.id,
        'installation_id', v_installation,
        'was_revoked', v_existing.revoked_at IS NOT NULL,
        'previous_expires_at', v_existing.expires_at
      )
    );
  ELSE
    v_desk_id := gen_random_uuid();

    INSERT INTO desk_devices (
      id,
      conference_id,
      token_hash,
      label,
      role,
      expires_at,
      installation_id
    )
    VALUES (
      v_desk_id,
      v_code.conference_id,
      lower(trim(p_token_hash)),
      v_label,
      'linked',
      v_expires,
      v_installation
    );

    INSERT INTO desk_device_audit (conference_id, desk_device_id, action, details)
    VALUES (
      v_code.conference_id,
      v_desk_id,
      'linked_desktop_created',
      jsonb_build_object(
        'expires_at', v_expires,
        'join_code_id', v_code.id,
        'installation_id', v_installation
      )
    );
  END IF;

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
      'linked_desk_device_id', v_desk_id,
      'rejoined', v_rejoined,
      'installation_id', v_installation
    )
  );

  desk_device_id := v_desk_id;
  conference_id := v_code.conference_id;
  expires_at := v_expires;
  join_code_id := v_code.id;
  rejoined := v_rejoined;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION redeem_desk_join_code(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_desk_join_code(text, text, text, text) TO service_role;
