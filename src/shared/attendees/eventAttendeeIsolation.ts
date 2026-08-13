/**
 * Pure helpers for event-scoped attendee isolation (Sprint 23 cross-event blocker).
 */

/** Prefer EventAccessSession event identity over persisted settings while unlocked. */
export function resolveAuthorizedEventId(input: {
  sessionEventId: string | null | undefined
  persistedActiveEventId?: string | null | undefined
}): string | null {
  const session = input.sessionEventId?.trim() || null
  if (session) {
    return session
  }
  // Locked / no session: callers must not expose attendees via session APIs.
  void input.persistedActiveEventId
  return null
}

/** In-memory cache may only serve attendees when its event matches the session. */
export function attendeeCacheBelongsToEvent(input: {
  cacheEventId: string | null | undefined
  authorizedEventId: string | null | undefined
  cacheInitialized: boolean
}): boolean {
  const authorized = input.authorizedEventId?.trim() || null
  const cacheEvent = input.cacheEventId?.trim() || null
  if (!input.cacheInitialized || !authorized || !cacheEvent) {
    return false
  }
  return cacheEvent === authorized
}

/**
 * Fail-closed selection for getAttendees-style reads.
 * Never returns Event A rows while authorized for Event B.
 */
export function selectAttendeesForAuthorizedEvent<T extends { eventId?: string }>(input: {
  authorizedEventId: string | null | undefined
  cacheEventId: string | null | undefined
  cacheInitialized: boolean
  cachedAttendees: readonly T[]
}): T[] {
  if (
    !attendeeCacheBelongsToEvent({
      cacheEventId: input.cacheEventId,
      authorizedEventId: input.authorizedEventId,
      cacheInitialized: input.cacheInitialized,
    })
  ) {
    return []
  }
  const authorized = input.authorizedEventId!.trim()
  return input.cachedAttendees.filter((row) => {
    const rowEvent = typeof row.eventId === 'string' ? row.eventId.trim() : ''
    return !rowEvent || rowEvent === authorized
  })
}
