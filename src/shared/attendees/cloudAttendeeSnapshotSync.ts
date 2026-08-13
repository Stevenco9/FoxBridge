/**
 * Pure helpers for Linked/Principal Cloud → local attendee snapshot convergence.
 * Cursor is conferences.last_desktop_sync_at (Principal publish revision).
 */

export function shouldPullCloudAttendeeSnapshot(input: {
  /** Local cursor of last successfully applied Cloud snapshot (ISO). */
  localCursorTimestamp: string | null | undefined
  /** conferences.last_desktop_sync_at from Cloud (ISO). */
  cloudLastDesktopSyncAt: string | null | undefined
  /** Force pull even when timestamps match (join / manual refresh). */
  force?: boolean
}): boolean {
  if (input.force === true) {
    return true
  }

  const cloud = input.cloudLastDesktopSyncAt?.trim() || null
  if (!cloud) {
    // No published snapshot yet — still attempt pull once (may be empty).
    return !input.localCursorTimestamp?.trim()
  }

  const local = input.localCursorTimestamp?.trim() || null
  if (!local) {
    return true
  }

  return cloud > local
}

/** Safe (non-PII) diagnostic payload for attendee hydrate / sync logs. */
export function buildAttendeeHydrateDiagnostics(input: {
  sessionEventId: string | null | undefined
  deskConferenceId: string | null | undefined
  pullConferenceId: string | null | undefined
  cacheEventId: string | null | undefined
  pullAttendeeCount: number
  pullEntitlementCount: number
  mappedAttendeeCount: number
  localStoredAttendeeCount?: number | null
  lastDesktopSyncAt?: string | null
  success: boolean
  message?: string | null
}): Record<string, string | number | boolean | null> {
  return {
    sessionEventId: input.sessionEventId?.trim() || null,
    deskConferenceId: input.deskConferenceId?.trim() || null,
    pullConferenceId: input.pullConferenceId?.trim() || null,
    cacheEventId: input.cacheEventId?.trim() || null,
    pullAttendeeCount: input.pullAttendeeCount,
    pullEntitlementCount: input.pullEntitlementCount,
    mappedAttendeeCount: input.mappedAttendeeCount,
    localStoredAttendeeCount:
      typeof input.localStoredAttendeeCount === 'number'
        ? input.localStoredAttendeeCount
        : null,
    lastDesktopSyncAt: input.lastDesktopSyncAt?.trim() || null,
    success: input.success,
    message: input.message?.trim() || null,
  }
}
