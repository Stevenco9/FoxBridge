import type { Attendee } from '../models'

export interface PublishIdentityInput {
  sessionEventId: string | null | undefined
  sessionConferenceId: string | null | undefined
  deskConferenceId: string | null | undefined
  /** Attendees loaded explicitly for sessionEventId (Local Event Store). */
  storeAttendees: readonly Attendee[]
}

export type PublishIdentityResult =
  | { ok: true; eventId: string; conferenceId: string; attendees: Attendee[] }
  | { ok: false; reason: string }

/**
 * Fail-closed gate before any Cloud attendee/entitlement publish.
 * sessionEventId = publishEventId = attendeeSourceEventId; conference must match desk.
 */
export function resolvePublishAttendeeSnapshot(
  input: PublishIdentityInput,
): PublishIdentityResult {
  const sessionEventId = input.sessionEventId?.trim() || null
  if (!sessionEventId) {
    return { ok: false, reason: 'Event access session has no event identity for publish.' }
  }

  const deskConferenceId = input.deskConferenceId?.trim() || null
  if (!deskConferenceId) {
    return { ok: false, reason: 'Desk credential conference is required for publish.' }
  }

  const sessionConferenceId = input.sessionConferenceId?.trim() || null
  if (sessionConferenceId && sessionConferenceId !== deskConferenceId) {
    return {
      ok: false,
      reason: 'Event session conference does not match the desk credential conference.',
    }
  }

  const attendees: Attendee[] = []
  for (const attendee of input.storeAttendees) {
    const rowEvent = attendee.eventId?.trim() || ''
    if (rowEvent && rowEvent !== sessionEventId) {
      return {
        ok: false,
        reason: 'Local attendee snapshot contains rows from another FoxBridge Event.',
      }
    }
    attendees.push({
      ...attendee,
      eventId: sessionEventId,
    })
  }

  if (attendees.length === 0) {
    return {
      ok: false,
      reason: 'No attendees are stored for the active FoxBridge Event.',
    }
  }

  return {
    ok: true,
    eventId: sessionEventId,
    conferenceId: deskConferenceId,
    attendees,
  }
}

/** Pure helper for tests: stale A cache must never be accepted as B publish source. */
export function wouldPublishCrossEventLeak(input: {
  sessionEventId: string
  cacheEventId: string | null
  cacheAttendees: readonly Attendee[]
}): boolean {
  const session = input.sessionEventId.trim()
  const cacheEvent = input.cacheEventId?.trim() || null
  if (!cacheEvent || cacheEvent === session) {
    return input.cacheAttendees.some(
      (row) => row.eventId?.trim() && row.eventId.trim() !== session,
    )
  }
  // Cache bound to another event while session is B — classic A→B leak if publish used cache.
  return cacheEvent !== session && input.cacheAttendees.length > 0
}
