-- FoxBridge Supabase schema (Sprint 10 foundation)
-- Run in Supabase SQL editor before first desktop publish.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS conferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  name text NOT NULL,
  regfox_event_id text,
  timezone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_desktop_sync_at timestamptz
);

CREATE TABLE IF NOT EXISTS attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  attendee_id text NOT NULL,
  registration_id text NOT NULL,
  display_name text NOT NULL,
  email text,
  qr_identifier text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conference_id, attendee_id)
);

CREATE INDEX IF NOT EXISTS attendees_conference_qr_idx
  ON attendees (conference_id, qr_identifier);

CREATE TABLE IF NOT EXISTS meal_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id uuid NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  attendee_id text NOT NULL,
  meal_key text NOT NULL,
  meal_label text NOT NULL,
  source text NOT NULL,
  source_plan_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conference_id, attendee_id, meal_key)
);

CREATE INDEX IF NOT EXISTS meal_entitlements_conference_attendee_idx
  ON meal_entitlements (conference_id, attendee_id);

-- Example conference bootstrap (replace values, then set SUPABASE_CONFERENCE_ID to the id):
-- INSERT INTO conferences (id, slug, name, regfox_event_id)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'adagra-2026', 'AdAgrA 2026', 'your_regfox_event_id');
