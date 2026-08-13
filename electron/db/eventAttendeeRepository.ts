import type Database from 'better-sqlite3'
import type { Attendee } from '../../src/shared/models'
import { normalizeStoredAttendee } from '../../src/shared/attendees/normalizeStoredAttendee'
import { getDatabase } from './database'

export type RegistrationSourcePlatform = 'regfox' | string

interface EventAttendeeRow {
  id: string
  event_id: string
  registration_id: string
  source_platform: string
  payload: string
  synced_at: string
  updated_at: string
}

export interface ReplaceEventAttendeesInput {
  eventId: string
  attendees: readonly Attendee[]
  /** Registration platform that produced this snapshot (e.g. regfox). */
  sourcePlatform: RegistrationSourcePlatform
  syncedAt?: string
}

/**
 * Deduplicate by platform attendee id within one event snapshot (last wins).
 * Prevents UNIQUE(event_id, id) failures from duplicate Cloud rows.
 */
export function dedupeAttendeesByPlatformId(
  attendees: readonly Attendee[],
): Attendee[] {
  const byId = new Map<string, Attendee>()
  for (const attendee of attendees) {
    const id = attendee.id?.trim()
    if (!id) {
      continue
    }
    byId.set(id, attendee)
  }
  return [...byId.values()]
}

/**
 * Local Event Store — registration working dataset for Desktop.
 *
 * Row identity: PRIMARY KEY (event_id, id) where `id` is the stable platform
 * attendee identity (RegFox / Cloud attendee_id). The same platform id may
 * exist under multiple FoxBridge Events without collision.
 *
 * Distinct from operational tables (meal_validations, badge_print_logs, check-ins)
 * and from event-settings.json (UI config).
 */
export function replaceEventAttendees(
  input: ReplaceEventAttendeesInput,
  db: Database.Database = getDatabase(),
): number {
  const eventId = input.eventId.trim()
  if (!eventId) {
    return 0
  }

  const syncedAt = input.syncedAt?.trim() || new Date().toISOString()
  const sourcePlatform = input.sourcePlatform.trim() || 'unknown'
  const attendees = dedupeAttendeesByPlatformId(input.attendees)

  // better-sqlite3 transactions roll back on throw — failed insert must not
  // leave the active event empty after a partial delete.
  const replace = db.transaction(() => {
    db.prepare(`DELETE FROM event_attendees WHERE event_id = ?`).run(eventId)

    const insert = db.prepare(
      `INSERT INTO event_attendees (
        event_id, id, registration_id, source_platform, payload, synced_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )

    let count = 0
    for (const attendee of attendees) {
      const id = attendee.id.trim()
      if (!id) {
        continue
      }

      const payloadAttendee: Attendee = {
        ...attendee,
        eventId,
        syncedAt: attendee.syncedAt ?? syncedAt,
        updatedAt: attendee.updatedAt || syncedAt,
      }

      insert.run(
        eventId,
        id,
        attendee.registrationId.trim() || id,
        sourcePlatform,
        JSON.stringify(payloadAttendee),
        syncedAt,
        payloadAttendee.updatedAt,
      )
      count += 1
    }

    return count
  })

  return replace()
}

export function getEventAttendees(
  eventId?: string | null,
  db: Database.Database = getDatabase(),
): Attendee[] {
  const trimmedEventId = eventId?.trim()

  // Fail-closed for operational reads: without an event id, return empty —
  // never a global cross-event snapshot (Sprint 23 isolation blocker).
  if (!trimmedEventId) {
    return []
  }

  const rows = db
    .prepare(
      `SELECT id, event_id, registration_id, source_platform, payload, synced_at, updated_at
       FROM event_attendees
       WHERE event_id = ?
       ORDER BY updated_at ASC`,
    )
    .all(trimmedEventId) as EventAttendeeRow[]

  const attendees: Attendee[] = []
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.payload) as unknown
      const attendee = normalizeStoredAttendee(parsed)
      if (attendee) {
        attendees.push(attendee)
      }
    } catch {
      // Skip corrupt rows; do not fail the whole hydrate.
    }
  }

  return attendees
}

/**
 * Lookup by platform attendee id within one FoxBridge Event.
 * Global id-only lookup is unsafe under multi-event composite keys.
 */
export function getEventAttendeeById(
  eventId: string | null | undefined,
  attendeeId: string,
  db: Database.Database = getDatabase(),
): Attendee | null {
  const event = eventId?.trim()
  const trimmed = attendeeId.trim()
  if (!event || !trimmed) {
    return null
  }

  const row = db
    .prepare(
      `SELECT payload FROM event_attendees WHERE event_id = ? AND id = ?`,
    )
    .get(event, trimmed) as { payload: string } | undefined

  if (!row) {
    return null
  }

  try {
    return normalizeStoredAttendee(JSON.parse(row.payload) as unknown)
  } catch {
    return null
  }
}

export function upsertEventAttendee(
  attendee: Attendee,
  sourcePlatform: RegistrationSourcePlatform = 'unknown',
  db: Database.Database = getDatabase(),
): void {
  const id = attendee.id.trim()
  const eventId = attendee.eventId.trim()
  if (!id || !eventId) {
    return
  }

  const syncedAt = attendee.syncedAt?.trim() || new Date().toISOString()
  const updatedAt = attendee.updatedAt || syncedAt

  db.prepare(
    `INSERT INTO event_attendees (
      event_id, id, registration_id, source_platform, payload, synced_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_id, id) DO UPDATE SET
      registration_id = excluded.registration_id,
      source_platform = excluded.source_platform,
      payload = excluded.payload,
      synced_at = excluded.synced_at,
      updated_at = excluded.updated_at`,
  ).run(
    eventId,
    id,
    attendee.registrationId.trim() || id,
    sourcePlatform.trim() || 'unknown',
    JSON.stringify({ ...attendee, syncedAt, updatedAt }),
    syncedAt,
    updatedAt,
  )
}

export function countEventAttendees(
  eventId?: string | null,
  db: Database.Database = getDatabase(),
): number {
  const trimmedEventId = eventId?.trim()
  if (!trimmedEventId) {
    return 0
  }

  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM event_attendees WHERE event_id = ?`)
    .get(trimmedEventId) as { count: number }
  return row.count
}

export function getEventSourcePlatform(
  eventId?: string | null,
  db: Database.Database = getDatabase(),
): string | null {
  const trimmedEventId = eventId?.trim()
  if (!trimmedEventId) {
    return null
  }

  const row = db
    .prepare(`SELECT source_platform FROM event_attendees WHERE event_id = ? LIMIT 1`)
    .get(trimmedEventId) as { source_platform: string } | undefined

  return row?.source_platform ?? null
}
