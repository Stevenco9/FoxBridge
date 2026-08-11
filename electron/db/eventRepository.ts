import { randomUUID } from 'node:crypto'
import type { EnsureEventInput, Event, RegistrationPlatform } from '../../src/shared/models/Event'
import { getDatabase } from './database'
import { getEventAttendees, replaceEventAttendees } from './eventAttendeeRepository'

interface EventRow {
  id: string
  name: string
  registration_platform: string
  platform_event_id: string
  created_at: string
  last_synced_at: string | null
}

function mapRow(row: EventRow): Event {
  return {
    id: row.id,
    name: row.name,
    registrationPlatform: row.registration_platform as RegistrationPlatform,
    platformEventId: row.platform_event_id,
    createdAt: row.created_at,
    lastSyncedAt: row.last_synced_at,
  }
}

export function getEventById(id: string): Event | null {
  const trimmed = id.trim()
  if (!trimmed) {
    return null
  }

  const row = getDatabase()
    .prepare(
      `SELECT id, name, registration_platform, platform_event_id, created_at, last_synced_at
       FROM events WHERE id = ?`,
    )
    .get(trimmed) as EventRow | undefined

  return row ? mapRow(row) : null
}

export function findEventByPlatform(
  registrationPlatform: RegistrationPlatform,
  platformEventId: string,
): Event | null {
  const platform = String(registrationPlatform).trim()
  const platformId = platformEventId.trim()
  if (!platform || !platformId) {
    return null
  }

  const row = getDatabase()
    .prepare(
      `SELECT id, name, registration_platform, platform_event_id, created_at, last_synced_at
       FROM events
       WHERE registration_platform = ? AND platform_event_id = ?`,
    )
    .get(platform, platformId) as EventRow | undefined

  return row ? mapRow(row) : null
}

export function listEvents(): Event[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, name, registration_platform, platform_event_id, created_at, last_synced_at
       FROM events
       ORDER BY created_at ASC`,
    )
    .all() as EventRow[]

  return rows.map(mapRow)
}

/**
 * Creates or updates a FoxBridge Event for a registration-platform event.
 * Idempotent on (registration_platform, platform_event_id).
 */
export function ensureEvent(input: EnsureEventInput): Event {
  const platform = String(input.registrationPlatform).trim() as RegistrationPlatform
  const platformEventId = input.platformEventId.trim()
  if (!platform || !platformEventId) {
    throw new Error('registrationPlatform and platformEventId are required.')
  }

  const existing = findEventByPlatform(platform, platformEventId)
  const now = new Date().toISOString()
  const syncedAt = input.markSynced
    ? (input.syncedAt?.trim() || now)
    : null
  const defaultName =
    input.name?.trim() ||
    (platform === 'regfox' ? `RegFox ${platformEventId}` : `${platform} ${platformEventId}`)

  if (existing) {
    const nextName = input.name?.trim() || existing.name
    const nextSyncedAt = syncedAt ?? existing.lastSyncedAt
    getDatabase()
      .prepare(
        `UPDATE events
         SET name = ?, last_synced_at = ?
         WHERE id = ?`,
      )
      .run(nextName, nextSyncedAt, existing.id)

    return {
      ...existing,
      name: nextName,
      lastSyncedAt: nextSyncedAt,
    }
  }

  const created: Event = {
    id: randomUUID(),
    name: defaultName,
    registrationPlatform: platform,
    platformEventId,
    createdAt: now,
    lastSyncedAt: syncedAt,
  }

  getDatabase()
    .prepare(
      `INSERT INTO events (
        id, name, registration_platform, platform_event_id, created_at, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      created.id,
      created.name,
      created.registrationPlatform,
      created.platformEventId,
      created.createdAt,
      created.lastSyncedAt,
    )

  return created
}

/**
 * Moves Local Event Store rows from a legacy platform event id key to the
 * FoxBridge Event id (idempotent if already keyed by foxbridge id).
 */
export function rekeyLocalEventStoreAttendees(
  fromEventKey: string,
  toFoxbridgeEventId: string,
  sourcePlatform: RegistrationPlatform,
): void {
  const fromId = fromEventKey.trim()
  const toId = toFoxbridgeEventId.trim()
  if (!fromId || !toId || fromId === toId) {
    return
  }

  const existingTarget = getEventAttendees(toId)
  const legacy = getEventAttendees(fromId)
  if (legacy.length === 0) {
    return
  }

  const mergedById = new Map<string, (typeof legacy)[number]>()
  for (const attendee of existingTarget) {
    mergedById.set(attendee.id, { ...attendee, eventId: toId })
  }
  for (const attendee of legacy) {
    mergedById.set(attendee.id, { ...attendee, eventId: toId })
  }

  const syncedAt = new Date().toISOString()
  replaceEventAttendees({
    eventId: toId,
    attendees: [...mergedById.values()],
    sourcePlatform,
    syncedAt,
  })

  // Clear legacy platform-keyed rows after copy.
  replaceEventAttendees({
    eventId: fromId,
    attendees: [],
    sourcePlatform,
    syncedAt,
  })
}

export function touchEventSyncedAt(eventId: string, syncedAt?: string | null): void {
  const id = eventId.trim()
  if (!id) {
    return
  }

  getDatabase()
    .prepare(`UPDATE events SET last_synced_at = ? WHERE id = ?`)
    .run(syncedAt?.trim() || new Date().toISOString(), id)
}
