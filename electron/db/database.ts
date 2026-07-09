import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'

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
  `)
}

export function getDatabase(): Database.Database {
  if (!database) {
    database = new Database(getDatabasePath())
    database.pragma('journal_mode = WAL')
    initSchema(database)
  }

  return database
}

export function closeDatabase(): void {
  if (database) {
    database.close()
    database = null
  }
}
