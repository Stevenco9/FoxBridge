-- Fix validate_meal PL/pgSQL ambiguity between RETURNS TABLE columns and table columns.
-- Without this, RPC calls fail with Postgres 42702: column reference "meal_key" is ambiguous.

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
#variable_conflict use_column
DECLARE
  existing meal_validations%ROWTYPE;
  new_validated_at timestamptz := now();
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM meal_entitlements me
    WHERE me.conference_id = p_conference_id
      AND me.attendee_id = p_attendee_id
      AND me.meal_key = p_meal_key
  ) THEN
    RAISE EXCEPTION 'Meal not entitled for this attendee';
  END IF;

  SELECT mv.*
  INTO existing
  FROM meal_validations mv
  WHERE mv.conference_id = p_conference_id
    AND mv.attendee_id = p_attendee_id
    AND mv.meal_key = p_meal_key;

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
      SELECT mv.*
      INTO existing
      FROM meal_validations mv
      WHERE mv.conference_id = p_conference_id
        AND mv.attendee_id = p_attendee_id
        AND mv.meal_key = p_meal_key;

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
