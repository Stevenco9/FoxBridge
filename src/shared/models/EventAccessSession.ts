/**
 * Process-scoped event access (Sprint 23.1).
 * The active session lives only in the Electron main process — never persist it.
 */

/** How this process proved authorization to unlock the event. */
export type EventUnlockMethod = 'principal' | 'linked' | 'legacy' | 'regfox'

/** Safe snapshot for the renderer (no credentials). */
export interface EventAccessStatus {
  locked: boolean
  /** FoxBridge Event id when unlocked; null when locked. */
  eventId: string | null
  conferenceId: string | null
  unlockMethod: EventUnlockMethod | null
  unlockedAt: string | null
  /** Process-local session id when unlocked. */
  sessionId: string | null
}

/** Distinct code so the renderer can tell lock denial from network/DB failure. */
export const EVENT_ACCESS_LOCKED_CODE = 'EVENT_ACCESS_LOCKED' as const

export const EVENT_ACCESS_LOCKED_MESSAGE =
  'Event access is locked. Unlock this event to continue.' as const

export function isEventAccessLockedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  const record = error as { code?: unknown; message?: unknown }
  if (record.code === EVENT_ACCESS_LOCKED_CODE) {
    return true
  }
  return (
    typeof record.message === 'string' &&
    (record.message === EVENT_ACCESS_LOCKED_MESSAGE ||
      record.message.includes(EVENT_ACCESS_LOCKED_CODE))
  )
}
