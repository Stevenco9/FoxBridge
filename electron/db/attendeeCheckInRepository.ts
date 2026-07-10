import type { Attendee } from '../../src/shared/models'
import { getDatabase } from './database'

interface AttendeeCheckInRow {
  attendee_id: string
  registration_id: string
  checked_in_at: string
}

export interface PersistedAttendeeCheckIn {
  attendeeId: string
  registrationId: string
  checkedInAt: string
}

export function persistAttendeeCheckIn(record: PersistedAttendeeCheckIn): void {
  const db = getDatabase()
  db.prepare(
    `INSERT INTO attendee_check_ins (attendee_id, registration_id, checked_in_at, source)
     VALUES (?, ?, ?, 'desktop')
     ON CONFLICT(attendee_id) DO UPDATE SET
       registration_id = excluded.registration_id,
       checked_in_at = excluded.checked_in_at,
       source = excluded.source`,
  ).run(record.attendeeId, record.registrationId, record.checkedInAt)
}

export function getAllPersistedCheckIns(): Map<string, PersistedAttendeeCheckIn> {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT attendee_id, registration_id, checked_in_at
       FROM attendee_check_ins`,
    )
    .all() as AttendeeCheckInRow[]

  const map = new Map<string, PersistedAttendeeCheckIn>()
  for (const row of rows) {
    map.set(row.attendee_id, {
      attendeeId: row.attendee_id,
      registrationId: row.registration_id,
      checkedInAt: row.checked_in_at,
    })
  }

  return map
}

/**
 * Merges locally persisted check-ins into attendees downloaded from RegFox.
 * RegFox remains authoritative when it already reports checked-in status.
 */
export function applyPersistedCheckIns(attendees: Attendee[]): Attendee[] {
  const persisted = getAllPersistedCheckIns()
  if (persisted.size === 0) {
    return attendees
  }

  return attendees.map((attendee) => {
    const record = persisted.get(attendee.id)
    if (!record) {
      return attendee
    }

    if (attendee.checkedIn) {
      return {
        ...attendee,
        checkedInAt: attendee.checkedInAt ?? record.checkedInAt,
      }
    }

    return {
      ...attendee,
      checkedIn: true,
      checkedInAt: record.checkedInAt,
      updatedAt: new Date().toISOString(),
    }
  })
}
