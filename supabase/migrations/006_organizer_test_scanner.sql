-- Temporary organizer test scanner activation (Sprint 13B testing)
-- Creates a short-lived scanner session for the first conference.
-- Remove before production if no longer needed.

CREATE OR REPLACE FUNCTION activate_organizer_test_scanner()
RETURNS TABLE (
  session_id uuid,
  conference_id uuid,
  conference_name text,
  label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conf conferences%ROWTYPE;
  new_session_id uuid;
  new_code text;
BEGIN
  SELECT *
  INTO conf
  FROM conferences
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No conference is available yet.';
  END IF;

  new_code := 'organizer-test-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);

  INSERT INTO scanner_sessions (
    conference_id,
    code,
    label,
    role,
    paired_at,
    expires_at
  )
  VALUES (
    conf.id,
    new_code,
    'Organizer test scanner',
    'meal_scanner',
    now(),
    now() + interval '7 days'
  )
  RETURNING id INTO new_session_id;

  RETURN QUERY
  SELECT
    new_session_id,
    conf.id,
    conf.name,
    'Organizer test scanner'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION activate_organizer_test_scanner() TO anon;
