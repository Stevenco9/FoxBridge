import { isSupabaseConfigured } from '../cloud/supabaseConfig'
import { isEventAccessUnlocked } from '../session/eventAccessSession'
import { readPublicSettings } from '../settings/settingsStore'
import {
  CHECK_IN_SYNC_INTERVAL_MS,
  DESKTOP_SYNC_INTERVAL_MS,
  decideScheduledSyncStart,
} from './syncManagerHelpers'
import { syncBestEffort, syncCheckInStateBestEffort } from './syncService'

export {
  CHECK_IN_SYNC_INTERVAL_MS,
  DESKTOP_SYNC_INTERVAL_MS,
} from './syncManagerHelpers'

let started = false
let syncInProgress = false
let checkInSyncInProgress = false
let intervalHandle: ReturnType<typeof setInterval> | null = null
let checkInIntervalHandle: ReturnType<typeof setInterval> | null = null

/**
 * Desktop Sync Manager — lifecycle owner for ongoing Cloud → SQLite sync.
 *
 * Owns the schedule and overlap gate. Entity pull logic stays in
 * `syncService.sync()` so new SyncEntityHandler registrations participate
 * automatically without new timers.
 *
 * Never blocks startup or local workflows: callers must not await the
 * initial kickoff from `app.whenReady` critical path (use fire-and-forget).
 */
export function startDesktopSyncManager(): void {
  if (started) {
    return
  }

  started = true

  // Initial best-effort pull when lifecycle conditions are already met.
  void requestDesktopSyncBestEffort()
  void requestCheckInSyncBestEffort()

  intervalHandle = setInterval(() => {
    void requestDesktopSyncBestEffort()
  }, DESKTOP_SYNC_INTERVAL_MS)
  intervalHandle.unref?.()

  checkInIntervalHandle = setInterval(() => {
    void requestCheckInSyncBestEffort()
  }, CHECK_IN_SYNC_INTERVAL_MS)
  checkInIntervalHandle.unref?.()
}

export function stopDesktopSyncManager(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  if (checkInIntervalHandle) {
    clearInterval(checkInIntervalHandle)
    checkInIntervalHandle = null
  }
  started = false
}

export function isDesktopSyncManagerStarted(): boolean {
  return started
}

export function isDesktopSyncInProgress(): boolean {
  return syncInProgress || checkInSyncInProgress
}

/**
 * Best-effort sync entry for lifecycle hooks (interval, publish, connection test).
 * Skips when another run is in progress or preconditions fail. Never throws.
 */
export async function requestDesktopSyncBestEffort(): Promise<void> {
  try {
    const settings = await readPublicSettings()
    const decision = decideScheduledSyncStart({
      syncInProgress,
      activeEventId: settings.activeEventId,
      cloudConfigured: isSupabaseConfigured(),
      eventAccessUnlocked: isEventAccessUnlocked(),
    })

    if (decision !== 'run') {
      return
    }

    syncInProgress = true
    try {
      await syncBestEffort()
    } finally {
      syncInProgress = false
    }
  } catch (error) {
    syncInProgress = false
    console.warn(
      '[desktop-sync-manager]',
      error instanceof Error ? error.message : String(error),
    )
  }
}

/**
 * Fast check-in-only pull (12s). Independent overlap gate from full sync
 * so attendee_snapshot stays on the 5-minute cadence.
 */
export async function requestCheckInSyncBestEffort(): Promise<void> {
  try {
    const settings = await readPublicSettings()
    const decision = decideScheduledSyncStart({
      syncInProgress: checkInSyncInProgress,
      activeEventId: settings.activeEventId,
      cloudConfigured: isSupabaseConfigured(),
      eventAccessUnlocked: isEventAccessUnlocked(),
    })

    if (decision !== 'run') {
      return
    }

    checkInSyncInProgress = true
    try {
      await syncCheckInStateBestEffort()
    } finally {
      checkInSyncInProgress = false
    }
  } catch (error) {
    checkInSyncInProgress = false
    console.warn(
      '[desktop-check-in-sync]',
      error instanceof Error ? error.message : String(error),
    )
  }
}
