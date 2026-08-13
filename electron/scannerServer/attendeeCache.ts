import type { Attendee } from '../../src/shared/models'
import { applyPersistedCheckIns } from '../db/attendeeCheckInRepository'
import {
  getEventAttendees,
  getEventSourcePlatform,
  replaceEventAttendees,
  upsertEventAttendee,
  type RegistrationSourcePlatform,
} from '../db/eventAttendeeRepository'

let cachedAttendees: Attendee[] = []
/** FoxBridge Event id the in-memory cache currently represents (null if empty/cleared). */
let cacheEventId: string | null = null
/** True after hydrate from Local Event Store or a registration sync write. */
let cacheInitialized = false
let lastSourcePlatform: RegistrationSourcePlatform = 'unknown'

export function clearAttendeeCache(): void {
  cachedAttendees = []
  cacheEventId = null
  cacheInitialized = false
  lastSourcePlatform = 'unknown'
}

export function setAttendeeCache(attendees: Attendee[], eventId?: string | null): void {
  const scopedEventId = eventId?.trim() || attendees[0]?.eventId?.trim() || null
  cachedAttendees = attendees
  cacheEventId = scopedEventId
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
  const eventId = input.eventId.trim()
  if (!eventId) {
    clearAttendeeCache()
    return
  }

  const syncedAt = input.syncedAt ?? new Date().toISOString()
  const withSyncMeta = input.attendees.map((attendee) => ({
    ...attendee,
    eventId,
    syncedAt: attendee.syncedAt ?? syncedAt,
  }))

  replaceEventAttendees({
    eventId,
    attendees: withSyncMeta,
    sourcePlatform: input.sourcePlatform,
    syncedAt,
  })

  lastSourcePlatform = input.sourcePlatform
  setAttendeeCache(
    applyPersistedCheckIns(withSyncMeta, eventId),
    eventId,
  )
}

export function getAttendeeCache(): Attendee[] {
  return cachedAttendees
}

export function getAttendeeCacheEventId(): string | null {
  return cacheEventId
}

export function updateAttendeeInCache(updated: Attendee): void {
  const updatedEventId = updated.eventId?.trim()
  if (cacheEventId && updatedEventId && updatedEventId !== cacheEventId) {
    // Refuse cross-event cache mutation.
    return
  }

  cachedAttendees = cachedAttendees.map((attendee) =>
    attendee.id === updated.id ? updated : attendee,
  )

  if (cacheInitialized && cacheEventId) {
    upsertEventAttendee(updated, lastSourcePlatform)
  }
}

/**
 * Sprint 23.5a — apply operational check-in to in-memory cache only.
 * Does not rewrite rich Local Event Store rows (overlay table is authority).
 */
export function patchAttendeeCheckInInCache(input: {
  attendeeId: string
  eventId: string
  checkedIn: boolean
  checkedInAt: string
}): Attendee | null {
  const eventId = input.eventId.trim()
  if (!eventId || cacheEventId !== eventId) {
    return null
  }

  let updated: Attendee | null = null
  cachedAttendees = cachedAttendees.map((attendee) => {
    if (attendee.id !== input.attendeeId) {
      return attendee
    }
    updated = {
      ...attendee,
      checkedIn: input.checkedIn,
      checkedInAt: input.checkedInAt,
    }
    return updated
  })
  return updated
}

/** Re-apply event-scoped operational overlays onto the current cache. */
export function reapplyOperationalCheckInsToCache(eventId?: string | null): void {
  const trimmed = eventId?.trim() || cacheEventId
  if (!trimmed || !cacheInitialized) {
    return
  }
  cachedAttendees = applyPersistedCheckIns(cachedAttendees, trimmed)
}

/**
 * Loads Local Event Store rows for ONE FoxBridge Event into memory.
 * Requires eventId — never falls back to an unscoped / all-events snapshot.
 * Applies operational check-in overlay after LES hydrate.
 */
export function hydrateAttendeeCacheFromLocalEventStore(eventId?: string | null): number {
  const trimmed = eventId?.trim()
  if (!trimmed) {
    clearAttendeeCache()
    return 0
  }

  const attendees = applyPersistedCheckIns(getEventAttendees(trimmed), trimmed)
  cachedAttendees = attendees
  cacheEventId = trimmed
  cacheInitialized = true
  lastSourcePlatform = getEventSourcePlatform(trimmed) ?? 'unknown'
  return attendees.length
}

/**
 * Bind memory to a specific event. If the cache already matches, keep it.
 * Otherwise clear and hydrate from Local Event Store for that event only.
 */
export function ensureAttendeeCacheForEvent(eventId: string | null | undefined): number {
  const trimmed = eventId?.trim()
  if (!trimmed) {
    clearAttendeeCache()
    return 0
  }

  if (cacheInitialized && cacheEventId === trimmed) {
    return cachedAttendees.length
  }

  return hydrateAttendeeCacheFromLocalEventStore(trimmed)
}

export function isAttendeeCacheLoaded(): boolean {
  return cacheInitialized
}

export function getAttendeeCacheCount(): number {
  return cachedAttendees.length
}
