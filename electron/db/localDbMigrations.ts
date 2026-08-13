/**
 * Local SQLite schema migrations (Desktop userData foxbridge.db).
 * Idempotent. Never delete userData; preserve event rows, meals, settings.
 */

import type Database from 'better-sqlite3'

/** Bump when adding a new migrate step below. */
export const LOCAL_DB_USER_VERSION = 3

/**
 * Sprint 23.4a closeout — event_attendees.id was a global PRIMARY KEY
 * (platform attendee id). Multi-event Linked installs collided when the same
 * attendee id existed under two FoxBridge event_ids.
 *
 * Target: PRIMARY KEY (event_id, id) — id remains the stable platform
 * attendee identity within an event.
 */
function migrateEventAttendeesCompositePrimaryKey(db: Database.Database): void {
  const master = db
    .prepare(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'event_attendees'`,
    )
    .get() as { sql: string } | undefined

  if (!master?.sql) {
    return
  }

  const normalized = master.sql.replace(/\s+/g, ' ').toLowerCase()
  if (
    normalized.includes('primary key (event_id, id)') ||
    normalized.includes('primary key(event_id, id)')
  ) {
    return
  }

  db.exec(`
    CREATE TABLE event_attendees_v2 (
      event_id TEXT NOT NULL,
      id TEXT NOT NULL,
      registration_id TEXT NOT NULL,
      source_platform TEXT NOT NULL,
      payload TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, id)
    );

    INSERT INTO event_attendees_v2 (
      event_id, id, registration_id, source_platform, payload, synced_at, updated_at
    )
    SELECT
      event_id, id, registration_id, source_platform, payload, synced_at, updated_at
    FROM event_attendees;

    DROP TABLE event_attendees;
    ALTER TABLE event_attendees_v2 RENAME TO event_attendees;

    CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id
      ON event_attendees(event_id);
    CREATE INDEX IF NOT EXISTS idx_event_attendees_registration_id
      ON event_attendees(registration_id);
  `)
}

/**
 * Sprint 23.5a — event-scoped operational check-in overlay.
 * Migrates legacy global attendee_check_ins into (event_id, attendee_id) rows
 * when the attendee exists in Local Event Store for that event.
 */
function migrateEventScopedCheckInOverlay(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS event_attendee_check_ins (
      event_id TEXT NOT NULL,
      attendee_id TEXT NOT NULL,
      registration_id TEXT NOT NULL,
      checked_in INTEGER NOT NULL DEFAULT 1,
      checked_in_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'desktop',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, attendee_id)
    );

    CREATE INDEX IF NOT EXISTS idx_event_attendee_check_ins_event_id
      ON event_attendee_check_ins(event_id);
  `)

  const legacy = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'attendee_check_ins'`,
    )
    .get() as { name: string } | undefined

  if (!legacy) {
    return
  }

  // Attach legacy global check-ins to every Local Event Store event that
  // already contains that attendee id (preserves A/B isolation).
  db.exec(`
    INSERT OR IGNORE INTO event_attendee_check_ins (
      event_id, attendee_id, registration_id, checked_in, checked_in_at, source, updated_at
    )
    SELECT
      ea.event_id,
      ac.attendee_id,
      ac.registration_id,
      1,
      ac.checked_in_at,
      COALESCE(ac.source, 'desktop'),
      ac.checked_in_at
    FROM attendee_check_ins ac
    INNER JOIN event_attendees ea ON ea.id = ac.attendee_id;

    DROP TABLE attendee_check_ins;
  `)
}

/**
 * Apply pending local DB migrations. Safe to call on every open.
 */
export function migrateLocalDatabase(db: Database.Database): void {
  const current = Number(db.pragma('user_version', { simple: true }))

  if (current < 2) {
    migrateEventAttendeesCompositePrimaryKey(db)
    db.pragma('user_version = 2')
  }

  if (Number(db.pragma('user_version', { simple: true })) < 3) {
    migrateEventScopedCheckInOverlay(db)
    db.pragma(`user_version = ${LOCAL_DB_USER_VERSION}`)
  }
}
