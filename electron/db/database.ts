import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import { migrateLocalDatabase } from './localDbMigrations'

let database: Database.Database | null = null

function getDatabasePath(): string {
  return path.join(app.getPath('userData'), 'foxbridge.db')
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meal_validations (
      id TEXT PRIMARY KEY,
      attendee_id TEXT NOT NULL,
      meal_key TEXT NOT NULL,
      meal_label TEXT NOT NULL,
      validated_at TEXT NOT NULL,
      validated_by TEXT,
      source TEXT NOT NULL DEFAULT 'desktop',
      UNIQUE(attendee_id, meal_key)
    );

    -- Sprint 23.5a — event-scoped operational check-in overlay (Cloud-first).
    -- Legacy global attendee_check_ins is migrated in localDbMigrations v3.
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

    CREATE TABLE IF NOT EXISTS badge_print_logs (
      id TEXT PRIMARY KEY,
      attendee_id TEXT NOT NULL,
      printed_at TEXT NOT NULL,
      printer_name TEXT,
      workstation TEXT,
      operator TEXT,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_badge_print_logs_attendee_id
      ON badge_print_logs(attendee_id);

    CREATE INDEX IF NOT EXISTS idx_badge_print_logs_attendee_printed_at
      ON badge_print_logs(attendee_id, printed_at);

    -- Local Event Store: registration working dataset (event-scoped PK).
    -- id = platform attendee identity; PRIMARY KEY (event_id, id) allows the
    -- same attendee id under multiple FoxBridge Events (multi-event Linked).
    CREATE TABLE IF NOT EXISTS event_attendees (
      event_id TEXT NOT NULL,
      id TEXT NOT NULL,
      registration_id TEXT NOT NULL,
      source_platform TEXT NOT NULL,
      payload TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, id)
    );

    CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id
      ON event_attendees(event_id);

    CREATE INDEX IF NOT EXISTS idx_event_attendees_registration_id
      ON event_attendees(registration_id);

    -- FoxBridge Event identity (platform-independent)
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      registration_platform TEXT NOT NULL,
      platform_event_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_synced_at TEXT,
      UNIQUE (registration_platform, platform_event_id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_platform_event
      ON events(registration_platform, platform_event_id);
  `)
}

export function getDatabase(): Database.Database {
  if (!database) {
    database = new Database(getDatabasePath())
    database.pragma('journal_mode = WAL')
    initSchema(database)
    migrateLocalDatabase(database)
  }

  return database
}

export function closeDatabase(): void {
  if (database) {
    database.close()
    database = null
  }
}

/** Test helper — reset singleton after closing a temp DB. */
export function resetDatabaseSingletonForTests(): void {
  closeDatabase()
}
