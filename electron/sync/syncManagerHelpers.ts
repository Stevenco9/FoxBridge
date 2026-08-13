/**
 * Pure scheduling helpers for Desktop Sync lifecycle (Sprint 21.4).
 * Kept Electron-free so scripts can unit-test without booting the app.
 */

/** Conservative Cloud → Desktop pull interval for registration snapshot / meals. */
export const DESKTOP_SYNC_INTERVAL_MS = 5 * 60 * 1000

/**
 * Sprint 23.5a — operational check-in convergence (other desks).
 * Writers update immediately from Edge; peers poll this cadence.
 * Do not use this interval for attendee_snapshot.
 */
export const CHECK_IN_SYNC_INTERVAL_MS = 12 * 1000

export type ScheduledSyncDecision =
  | 'run'
  | 'skip_in_progress'
  | 'skip_no_active_event'
  | 'skip_cloud_unavailable'
  | 'skip_event_locked'

/**
 * Whether a scheduled (or requested) sync should start a new run.
 * Overlap and readiness checks live here; entity work stays in syncService.
 */
export function decideScheduledSyncStart(input: {
  syncInProgress: boolean
  activeEventId: string | null | undefined
  cloudConfigured: boolean
  /** Sprint 23.1 — process EventAccessSession must be unlocked. */
  eventAccessUnlocked?: boolean
}): ScheduledSyncDecision {
  if (input.syncInProgress) {
    return 'skip_in_progress'
  }

  if (input.eventAccessUnlocked === false) {
    return 'skip_event_locked'
  }

  if (!input.activeEventId?.trim()) {
    return 'skip_no_active_event'
  }

  if (!input.cloudConfigured) {
    return 'skip_cloud_unavailable'
  }

  return 'run'
}
