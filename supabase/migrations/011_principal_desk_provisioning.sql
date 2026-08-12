-- Sprint 22.1 — Principal Desktop provisioning foundation
-- Canonical external event identity, desk device roles, Principal uniqueness,
-- transactional Principal provision RPC, and safe audit log.
-- Does NOT implement Linked join-code issuance.

-- ---------------------------------------------------------------------------
-- 1) Canonical external event identity on conferences
-- ---------------------------------------------------------------------------

ALTER TABLE conferences
  ADD COLUMN IF NOT EXISTS registration_platform text;

ALTER TABLE conferences
  ADD COLUMN IF NOT EXISTS external_event_id text;

-- Backfill from legacy RegFox column (preserve compatibility).
UPDATE conferences
SET
  registration_platform = COALESCE(NULLIF(trim(registration_platform), ''), 'regfox'),
  external_event_id = COALESCE(NULLIF(trim(external_event_id), ''), NULLIF(trim(regfox_event_id), ''))
WHERE NULLIF(trim(regfox_event_id), '') IS NOT NULL
  AND (
    registration_platform IS NULL
    OR NULLIF(trim(registration_platform), '') IS NULL
    OR external_event_id IS NULL
    OR NULLIF(trim(external_event_id), '') IS NULL
  );

-- Fail loudly if duplicates would break uniqueness (do not merge/delete).
DO $$
DECLARE
  dup_count integer;
  dup_sample text;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT registration_platform, external_event_id
    FROM conferences
    WHERE registration_platform IS NOT NULL
      AND external_event_id IS NOT NULL
    GROUP BY registration_platform, external_event_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    SELECT string_agg(format('%s/%s (%s rows)', registration_platform, external_event_id, cnt), ', ')
    INTO dup_sample
    FROM (
      SELECT registration_platform, external_event_id, COUNT(*) AS cnt
      FROM conferences
      WHERE registration_platform IS NOT NULL
        AND external_event_id IS NOT NULL
      GROUP BY registration_platform, external_event_id
      HAVING COUNT(*) > 1
      LIMIT 10
    ) s;

    RAISE EXCEPTION
      'Cannot add unique external event identity: % duplicate (registration_platform, external_event_id) group(s). Resolve manually before applying Sprint 22.1. Samples: %',
      dup_count,
      COALESCE(dup_sample, '(none)');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS conferences_platform_external_event_uidx
  ON conferences (registration_platform, external_event_id)
  WHERE registration_platform IS NOT NULL
    AND external_event_id IS NOT NULL;

COMMENT ON COLUMN conferences.registration_platform IS
  'Upstream registration platform key (e.g. regfox). Part of canonical external identity (Sprint 22.1).';
COMMENT ON COLUMN conferences.external_event_id IS
  'Upstream event/page id. With registration_platform forms UNIQUE canonical identity (Sprint 22.1).';

-- ---------------------------------------------------------------------------
-- 2) Desk device roles
-- ---------------------------------------------------------------------------

ALTER TABLE desk_devices
  ADD COLUMN IF NOT EXISTS role text;

-- Legacy Sprint 21 devices (and any NULL role rows): treat as legacy.
UPDATE desk_devices
SET role = 'legacy'
WHERE role IS NULL OR NULLIF(trim(role), '') IS NULL;

ALTER TABLE desk_devices
  ALTER COLUMN role SET DEFAULT 'legacy';

ALTER TABLE desk_devices
  ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'desk_devices_role_check'
  ) THEN
    ALTER TABLE desk_devices
      ADD CONSTRAINT desk_devices_role_check
      CHECK (role IN ('principal', 'linked', 'legacy'));
  END IF;
END $$;

COMMENT ON COLUMN desk_devices.role IS
  'principal | linked | legacy. Sprint 21 operator-enrolled devices migrate to legacy (full desk ops; no Principal-only management). Linked issuance is Sprint 22.2+.';

-- At most one active (non-revoked) Principal per conference.
CREATE UNIQUE INDEX IF NOT EXISTS desk_devices_one_active_principal_uidx
  ON desk_devices (conference_id)
  WHERE role = 'principal' AND revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Safe audit log (no secrets / raw tokens / API keys)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS desk_device_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  desk_device_id uuid REFERENCES desk_devices(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT desk_device_audit_action_check CHECK (
    action IN (
      'principal_claimed',
      'principal_transferred',
      'principal_revoked'
    )
  )
);

CREATE INDEX IF NOT EXISTS desk_device_audit_conference_idx
  ON desk_device_audit (conference_id, created_at DESC);

ALTER TABLE desk_device_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE desk_device_audit FROM anon, authenticated;
GRANT ALL ON TABLE desk_device_audit TO service_role;

COMMENT ON TABLE desk_device_audit IS
  'Principal claim/transfer/revoke audit. Never store registration API keys or raw desk tokens.';

-- ---------------------------------------------------------------------------
-- 4) Transactional Principal provision (revoke prior + insert new)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION provision_principal_desk_device(
  p_conference_id uuid,
  p_token_hash text,
  p_label text DEFAULT NULL
)
RETURNS TABLE (
  desk_device_id uuid,
  transferred boolean,
  revoked_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_revoked integer := 0;
  v_new_id uuid;
  v_prev record;
BEGIN
  IF p_conference_id IS NULL THEN
    RAISE EXCEPTION 'conference_id is required';
  END IF;
  IF p_token_hash IS NULL OR length(trim(p_token_hash)) = 0 THEN
    RAISE EXCEPTION 'token_hash is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM conferences c WHERE c.id = p_conference_id) THEN
    RAISE EXCEPTION 'conference not found';
  END IF;

  -- Revoke every active Principal for this event (enforces one-active-Principal).
  FOR v_prev IN
    SELECT id
    FROM desk_devices
    WHERE conference_id = p_conference_id
      AND role = 'principal'
      AND revoked_at IS NULL
    FOR UPDATE
  LOOP
    UPDATE desk_devices
    SET revoked_at = v_now
    WHERE id = v_prev.id;

    INSERT INTO desk_device_audit (conference_id, desk_device_id, action, details)
    VALUES (
      p_conference_id,
      v_prev.id,
      'principal_revoked',
      jsonb_build_object('reason', 'principal_transfer')
    );

    v_revoked := v_revoked + 1;
  END LOOP;

  INSERT INTO desk_devices (conference_id, token_hash, label, role)
  VALUES (
    p_conference_id,
    trim(p_token_hash),
    NULLIF(trim(p_label), ''),
    'principal'
  )
  RETURNING id INTO v_new_id;

  IF v_revoked > 0 THEN
    INSERT INTO desk_device_audit (conference_id, desk_device_id, action, details)
    VALUES (
      p_conference_id,
      v_new_id,
      'principal_transferred',
      jsonb_build_object('revoked_count', v_revoked)
    );
  ELSE
    INSERT INTO desk_device_audit (conference_id, desk_device_id, action, details)
    VALUES (
      p_conference_id,
      v_new_id,
      'principal_claimed',
      jsonb_build_object('revoked_count', 0)
    );
  END IF;

  desk_device_id := v_new_id;
  transferred := v_revoked > 0;
  revoked_count := v_revoked;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION provision_principal_desk_device(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION provision_principal_desk_device(uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION provision_principal_desk_device(uuid, text, text) TO service_role;

COMMENT ON FUNCTION provision_principal_desk_device(uuid, text, text) IS
  'Atomically revoke active Principals for a conference and insert a new Principal desk device (Sprint 22.1).';
