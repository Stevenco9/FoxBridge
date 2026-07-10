-- FoxBridge one-scan phone pairing (Sprint 13B)
-- Run after 004_mobile_meal_validation.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS scanner_pairing_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'meal_scanner',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scanner_pairing_tokens_conference_idx
  ON scanner_pairing_tokens (conference_id);

CREATE INDEX IF NOT EXISTS scanner_pairing_tokens_expires_idx
  ON scanner_pairing_tokens (expires_at);

ALTER TABLE scanner_pairing_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE scanner_sessions
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'meal_scanner';

ALTER TABLE scanner_sessions
  ADD COLUMN IF NOT EXISTS paired_at timestamptz;

CREATE OR REPLACE FUNCTION exchange_scanner_pairing_token(p_token text)
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
  token_row scanner_pairing_tokens%ROWTYPE;
  new_session_id uuid;
  new_label text := 'Phone scanner';
  token_hash_value text := encode(digest(p_token, 'sha256'), 'hex');
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Pairing code is missing.';
  END IF;

  SELECT *
  INTO token_row
  FROM scanner_pairing_tokens
  WHERE token_hash = token_hash_value
    AND used_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This pairing code is invalid, expired, or already used.';
  END IF;

  UPDATE scanner_pairing_tokens
  SET used_at = now()
  WHERE id = token_row.id;

  INSERT INTO scanner_sessions (
    conference_id,
    code,
    label,
    role,
    paired_at,
    expires_at
  )
  VALUES (
    token_row.conference_id,
    'paired-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
    new_label,
    token_row.role,
    now(),
    now() + interval '7 days'
  )
  RETURNING id INTO new_session_id;

  RETURN QUERY
  SELECT
    new_session_id,
    token_row.conference_id,
    c.name,
    new_label
  FROM conferences c
  WHERE c.id = token_row.conference_id;
END;
$$;

GRANT EXECUTE ON FUNCTION exchange_scanner_pairing_token(text) TO anon;
