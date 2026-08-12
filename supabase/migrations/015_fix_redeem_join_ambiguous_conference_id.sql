-- Sprint 22.5 closeout — fix ambiguous conference_id in redeem_desk_join_code
-- Live error (Postgres 42702): RETURNS TABLE output column "conference_id"
-- shadowed desk_devices.conference_id in the installation lookup SELECT.
-- Desktop always sends installation_id, so every Linked redeem hit this path.
-- Join codes were rolled back (unused) because the failure is inside the RPC.

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
  WHERE desk_join_codes.code_hash = lower(trim(p_code_hash))
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
    -- Qualify table columns: RETURNS TABLE defines conference_id/etc. as variables.
    SELECT * INTO v_existing
    FROM desk_devices AS d
    WHERE d.conference_id = v_code.conference_id
      AND d.role = 'linked'
      AND d.installation_id = v_installation
    FOR UPDATE;

    v_has_existing := FOUND;
  END IF;

  IF v_has_existing THEN
    UPDATE desk_devices AS d
    SET
      token_hash = lower(trim(p_token_hash)),
      label = v_label,
      expires_at = v_expires,
      revoked_at = NULL,
      last_used_at = now()
    WHERE d.id = v_existing.id;

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

  UPDATE desk_join_codes AS c
  SET
    used_at = now(),
    used_by_desk_device_id = v_desk_id
  WHERE c.id = v_code.id
    AND c.used_at IS NULL;

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
