-- FoxBridge mobile meal validation (Sprint 13)
-- Run after 003_mobile_attendee_lookup.sql

CREATE TABLE IF NOT EXISTS meal_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  attendee_id text NOT NULL,
  meal_key text NOT NULL,
  meal_label text NOT NULL,
  validated_at timestamptz NOT NULL DEFAULT now(),
  scanner_session_id uuid REFERENCES scanner_sessions(id),
  source text NOT NULL DEFAULT 'mobile',
  UNIQUE (conference_id, attendee_id, meal_key)
);

CREATE INDEX IF NOT EXISTS meal_validations_conference_attendee_idx
  ON meal_validations (conference_id, attendee_id);

ALTER TABLE meal_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_meal_validations ON meal_validations;
CREATE POLICY anon_read_meal_validations
  ON meal_validations
  FOR SELECT
  TO anon
  USING (true);

CREATE OR REPLACE FUNCTION validate_meal(
  p_conference_id uuid,
  p_attendee_id text,
  p_meal_key text,
  p_meal_label text,
  p_scanner_session_id uuid DEFAULT NULL
)
RETURNS TABLE (
  status text,
  validated_at timestamptz,
  meal_key text,
  meal_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing meal_validations%ROWTYPE;
  new_validated_at timestamptz := now();
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM meal_entitlements
    WHERE conference_id = p_conference_id
      AND attendee_id = p_attendee_id
      AND meal_key = p_meal_key
  ) THEN
    RAISE EXCEPTION 'Meal not entitled for this attendee';
  END IF;

  SELECT *
  INTO existing
  FROM meal_validations
  WHERE conference_id = p_conference_id
    AND attendee_id = p_attendee_id
    AND meal_key = p_meal_key;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      'already_exists'::text,
      existing.validated_at,
      existing.meal_key,
      existing.meal_label;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO meal_validations (
      conference_id,
      attendee_id,
      meal_key,
      meal_label,
      validated_at,
      scanner_session_id,
      source
    ) VALUES (
      p_conference_id,
      p_attendee_id,
      p_meal_key,
      p_meal_label,
      new_validated_at,
      p_scanner_session_id,
      'mobile'
    );
  EXCEPTION
    WHEN unique_violation THEN
      SELECT *
      INTO existing
      FROM meal_validations
      WHERE conference_id = p_conference_id
        AND attendee_id = p_attendee_id
        AND meal_key = p_meal_key;

      RETURN QUERY
      SELECT
        'already_exists'::text,
        existing.validated_at,
        existing.meal_key,
        existing.meal_label;
      RETURN;
  END;

  RETURN QUERY
  SELECT
    'created'::text,
    new_validated_at,
    p_meal_key,
    p_meal_label;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_meal(uuid, text, text, text, uuid) TO anon;
