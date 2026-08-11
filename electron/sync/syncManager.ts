import { isSupabaseConfigured } from '../cloud/supabaseConfig'
import { readPublicSettings } from '../settings/settingsStore'
import {
  DESKTOP_SYNC_INTERVAL_MS,
  decideScheduledSyncStart,
} from './syncManagerHelpers'
import { syncBestEffort } from './syncService'

export { DESKTOP_SYNC_INTERVAL_MS } from './syncManagerHelpers'

let started = false
let syncInProgress = false
let intervalHandle: ReturnType<typeof setInterval> | null = null

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

  intervalHandle = setInterval(() => {
    void requestDesktopSyncBestEffort()
  }, DESKTOP_SYNC_INTERVAL_MS)

  // Do not keep the process alive solely for sync polling.
  intervalHandle.unref?.()
}

export function stopDesktopSyncManager(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  started = false
}

export function isDesktopSyncManagerStarted(): boolean {
  return started
}

export function isDesktopSyncInProgress(): boolean {
  return syncInProgress
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
