import type { Attendee } from '../../src/shared/models'
import {
  getEventAttendees,
  getEventSourcePlatform,
  replaceEventAttendees,
  upsertEventAttendee,
  type RegistrationSourcePlatform,
} from '../db/eventAttendeeRepository'

let cachedAttendees: Attendee[] = []
/** True after hydrate from Local Event Store or a registration sync write. */
let cacheInitialized = false
let lastSourcePlatform: RegistrationSourcePlatform = 'unknown'

export function setAttendeeCache(attendees: Attendee[]): void {
  cachedAttendees = attendees
  cacheInitialized = true
}

/**
 * Replaces the in-memory cache and persists the snapshot to the Local Event Store.
 * Call this after a registration-platform adapter has mapped into Attendee[].
 */
export function replaceAttendeeCacheFromRegistrationSync(input: {
  attendees: Attendee[]
  eventId: string
  sourcePlatform: RegistrationSourcePlatform
  syncedAt?: string
}): void {
  const syncedAt = input.syncedAt ?? new Date().toISOString()
  const withSyncMeta = input.attendees.map((attendee) => ({
    ...attendee,
    eventId: input.eventId.trim() || attendee.eventId,
    syncedAt: attendee.syncedAt ?? syncedAt,
  }))

  replaceEventAttendees({
    eventId: input.eventId,
    attendees: withSyncMeta,
    sourcePlatform: input.sourcePlatform,
    syncedAt,
  })

  lastSourcePlatform = input.sourcePlatform
  setAttendeeCache(withSyncMeta)
}

export function getAttendeeCache(): Attendee[] {
  return cachedAttendees
}

export function updateAttendeeInCache(updated: Attendee): void {
  cachedAttendees = cachedAttendees.map((attendee) =>
    attendee.id === updated.id ? updated : attendee,
  )

  if (cacheInitialized) {
    upsertEventAttendee(updated, lastSourcePlatform)
  }
}

/**
 * Loads Local Event Store rows into memory. Safe to call on every app start.
 * Returns the number of attendees loaded.
 */
export function hydrateAttendeeCacheFromLocalEventStore(eventId?: string | null): number {
  const attendees = getEventAttendees(eventId)
  cachedAttendees = attendees
  cacheInitialized = true
  lastSourcePlatform = getEventSourcePlatform(eventId) ?? 'unknown'
  return attendees.length
}

export function isAttendeeCacheLoaded(): boolean {
  return cacheInitialized
}

export function getAttendeeCacheCount(): number {
  return cachedAttendees.length
}
