-- Sprint 22.5 — SQL regression: issue → redeem → revoke → rejoin (same installation_id)
-- Run against linked FoxBridge Cloud after migration 015:
--   supabase db query --linked -f scripts/sql/linked_join_roundtrip_regression.sql
-- Replace conference/principal UUIDs if validating a different event.

DO $$
DECLARE
  v_conference uuid := 'd00f67ca-2d5b-4e3e-b7bb-659bc0031363';
  v_principal uuid := '924e466b-18c8-4786-95ba-fb88dea14481';
  v_install text := 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
  v_issue record;
  v_issue2 record;
  v_redeem record;
  v_rejoin record;
  v_hash text;
  v_hash2 text;
  v_token text := encode(digest(gen_random_bytes(32), 'sha256'), 'hex');
  v_token2 text := encode(digest(gen_random_bytes(32), 'sha256'), 'hex');
BEGIN
  SELECT * INTO v_issue
  FROM issue_desk_join_code(v_conference, v_principal, 15, 'sql-regression');

  v_hash := encode(digest(v_issue.raw_code, 'sha256'), 'hex');

  SELECT * INTO v_redeem
  FROM redeem_desk_join_code(v_hash, v_token, 'sql-regression-desk', v_install);

  IF v_redeem.rejoined THEN
    RAISE EXCEPTION 'first redeem should not set rejoined';
  END IF;

  UPDATE desk_devices
  SET revoked_at = now()
  WHERE id = v_redeem.desk_device_id;

  SELECT * INTO v_issue2
  FROM issue_desk_join_code(v_conference, v_principal, 15, 'sql-regression-rejoin');

  v_hash2 := encode(digest(v_issue2.raw_code, 'sha256'), 'hex');

  SELECT * INTO v_rejoin
  FROM redeem_desk_join_code(v_hash2, v_token2, 'sql-regression-desk', v_install);

  IF v_rejoin.desk_device_id IS DISTINCT FROM v_redeem.desk_device_id THEN
    RAISE EXCEPTION 'rejoin must reuse the same desk_device_id';
  END IF;

  IF NOT v_rejoin.rejoined THEN
    RAISE EXCEPTION 'rejoin must set rejoined=true';
  END IF;

  RAISE NOTICE 'linked_join_roundtrip_regression OK desk=%', v_redeem.desk_device_id;
END $$;
