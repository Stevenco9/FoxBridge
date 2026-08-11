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
 * Local Event Store — registration working dataset for Desktop.
 *
 * Distinct from operational tables (meal_validations, badge_print_logs, check-ins)
 * and from event-settings.json (UI config). Payload is the FoxBridge Attendee model
 * so future registration adapters can write the same rows.
 */
export function replaceEventAttendees(input: ReplaceEventAttendeesInput): number {
  const eventId = input.eventId.trim()
  if (!eventId) {
    return 0
  }

  const syncedAt = input.syncedAt?.trim() || new Date().toISOString()
  const sourcePlatform = input.sourcePlatform.trim() || 'unknown'
  const db = getDatabase()

  const replace = db.transaction(() => {
    db.prepare(`DELETE FROM event_attendees WHERE event_id = ?`).run(eventId)

    const insert = db.prepare(
      `INSERT INTO event_attendees (
        id, event_id, registration_id, source_platform, payload, synced_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )

    let count = 0
    for (const attendee of input.attendees) {
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
        id,
        eventId,
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

export function getEventAttendees(eventId?: string | null): Attendee[] {
  const db = getDatabase()
  const trimmedEventId = eventId?.trim()

  const rows = (
    trimmedEventId
      ? db
          .prepare(
            `SELECT id, event_id, registration_id, source_platform, payload, synced_at, updated_at
             FROM event_attendees
             WHERE event_id = ?
             ORDER BY updated_at ASC`,
          )
          .all(trimmedEventId)
      : db
          .prepare(
            `SELECT id, event_id, registration_id, source_platform, payload, synced_at, updated_at
             FROM event_attendees
             ORDER BY updated_at ASC`,
          )
          .all()
  ) as EventAttendeeRow[]

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

export function getEventAttendeeById(id: string): Attendee | null {
  const trimmed = id.trim()
  if (!trimmed) {
    return null
  }

  const db = getDatabase()
  const row = db
    .prepare(
      `SELECT payload FROM event_attendees WHERE id = ?`,
    )
    .get(trimmed) as { payload: string } | undefined

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
): void {
  const id = attendee.id.trim()
  const eventId = attendee.eventId.trim()
  if (!id || !eventId) {
    return
  }

  const syncedAt = attendee.syncedAt?.trim() || new Date().toISOString()
  const updatedAt = attendee.updatedAt || syncedAt
  const db = getDatabase()

  db.prepare(
    `INSERT INTO event_attendees (
      id, event_id, registration_id, source_platform, payload, synced_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      event_id = excluded.event_id,
      registration_id = excluded.registration_id,
      source_platform = excluded.source_platform,
      payload = excluded.payload,
      synced_at = excluded.synced_at,
      updated_at = excluded.updated_at`,
  ).run(
    id,
    eventId,
    attendee.registrationId.trim() || id,
    sourcePlatform.trim() || 'unknown',
    JSON.stringify({ ...attendee, syncedAt, updatedAt }),
    syncedAt,
    updatedAt,
  )
}

export function countEventAttendees(eventId?: string | null): number {
  const db = getDatabase()
  const trimmedEventId = eventId?.trim()
  if (trimmedEventId) {
    const row = db
      .prepare(`SELECT COUNT(*) AS count FROM event_attendees WHERE event_id = ?`)
      .get(trimmedEventId) as { count: number }
    return row.count
  }

  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM event_attendees`)
    .get() as { count: number }
  return row.count
}

export function getEventSourcePlatform(eventId?: string | null): string | null {
  const db = getDatabase()
  const trimmedEventId = eventId?.trim()
  const row = (
    trimmedEventId
      ? db
          .prepare(
            `SELECT source_platform FROM event_attendees WHERE event_id = ? LIMIT 1`,
          )
          .get(trimmedEventId)
      : db.prepare(`SELECT source_platform FROM event_attendees LIMIT 1`).get()
  ) as { source_platform: string } | undefined

  return row?.source_platform ?? null
}
