import type { Attendee } from '../../src/shared/models'
import { getDatabase } from './database'

interface EventAttendeeCheckInRow {
  event_id: string
  attendee_id: string
  registration_id: string
  checked_in: number
  checked_in_at: string
  source: string
  updated_at: string
}

export interface PersistedAttendeeCheckIn {
  eventId: string
  attendeeId: string
  registrationId: string
  checkedIn: boolean
  checkedInAt: string
  source?: string
  updatedAt?: string
}

/**
 * Upsert operational check-in overlay for one event + attendee.
 * Does not rewrite rich Local Event Store attendee payloads.
 */
export function persistEventAttendeeCheckIn(record: PersistedAttendeeCheckIn): void {
  const eventId = record.eventId.trim()
  const attendeeId = record.attendeeId.trim()
  if (!eventId || !attendeeId) {
    return
  }

  const updatedAt = record.updatedAt?.trim() || record.checkedInAt
  const db = getDatabase()
  db.prepare(
    `INSERT INTO event_attendee_check_ins (
       event_id, attendee_id, registration_id, checked_in, checked_in_at, source, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_id, attendee_id) DO UPDATE SET
       registration_id = excluded.registration_id,
       checked_in = excluded.checked_in,
       checked_in_at = excluded.checked_in_at,
       source = excluded.source,
       updated_at = excluded.updated_at`,
  ).run(
    eventId,
    attendeeId,
    record.registrationId,
    record.checkedIn ? 1 : 0,
    record.checkedInAt,
    record.source ?? 'desktop',
    updatedAt,
  )
}

export function getEventPersistedCheckIns(
  eventId: string,
): Map<string, PersistedAttendeeCheckIn> {
  const trimmed = eventId.trim()
  const map = new Map<string, PersistedAttendeeCheckIn>()
  if (!trimmed) {
    return map
  }

  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT event_id, attendee_id, registration_id, checked_in, checked_in_at, source, updated_at
       FROM event_attendee_check_ins
       WHERE event_id = ?`,
    )
    .all(trimmed) as EventAttendeeCheckInRow[]

  for (const row of rows) {
    map.set(row.attendee_id, {
      eventId: row.event_id,
      attendeeId: row.attendee_id,
      registrationId: row.registration_id,
      checkedIn: row.checked_in === 1,
      checkedInAt: row.checked_in_at,
      source: row.source,
      updatedAt: row.updated_at,
    })
  }

  return map
}

/**
 * Effective check-in = operational overlay when present, else base snapshot.
 * Overlay never erased by registration snapshot refresh.
 */
export function applyPersistedCheckIns(
  attendees: Attendee[],
  eventId?: string | null,
): Attendee[] {
  const scopedEventId =
    eventId?.trim() ||
    attendees.find((a) => a.eventId?.trim())?.eventId?.trim() ||
    null

  if (!scopedEventId) {
    return attendees
  }

  const persisted = getEventPersistedCheckIns(scopedEventId)
  if (persisted.size === 0) {
    return attendees
  }

  return attendees.map((attendee) => {
    if (attendee.eventId?.trim() && attendee.eventId.trim() !== scopedEventId) {
      return attendee
    }

    const record = persisted.get(attendee.id)
    if (!record) {
      return attendee
    }

    return {
      ...attendee,
      checkedIn: record.checkedIn,
      checkedInAt: record.checkedInAt,
      updatedAt: attendee.updatedAt,
    }
  })
}

/** @deprecated Use persistEventAttendeeCheckIn with eventId. */
export function persistAttendeeCheckIn(record: {
  attendeeId: string
  registrationId: string
  checkedInAt: string
  eventId: string
}): void {
  persistEventAttendeeCheckIn({
    eventId: record.eventId,
    attendeeId: record.attendeeId,
    registrationId: record.registrationId,
    checkedIn: true,
    checkedInAt: record.checkedInAt,
  })
}
