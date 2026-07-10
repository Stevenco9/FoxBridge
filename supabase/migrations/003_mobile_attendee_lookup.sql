-- FoxBridge mobile attendee lookup (Sprint 12)
-- Run after 002_mobile_scanner_foundation.sql

ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_attendees ON attendees;
CREATE POLICY anon_read_attendees
  ON attendees
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS anon_read_meal_entitlements ON meal_entitlements;
CREATE POLICY anon_read_meal_entitlements
  ON meal_entitlements
  FOR SELECT
  TO anon
  USING (true);
