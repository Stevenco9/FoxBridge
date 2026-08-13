import {
  getEventAccessSession,
  onEventAccessLocked,
  onEventAccessUnlocked,
} from './eventAccessSession'
import {
  isDesktopSyncManagerStarted,
  startDesktopSyncManager,
  stopDesktopSyncManager,
} from '../sync/syncManager'
import {
  maybeAutoStartScannerServer,
  stopScannerServer,
} from '../scannerServerHandlers'
import {
  clearAttendeeCache,
  ensureAttendeeCacheForEvent,
} from '../scannerServer/attendeeCache'
import { readDeskCredentialSync } from '../cloud/deskCredentialStore'
import {
  startUpstreamCheckInReconcilerManager,
  stopUpstreamCheckInReconcilerManager,
} from '../reconcile/upstreamCheckInReconcilerManager'

let lifecycleWired = false

/**
 * While locked: Sync Manager and event scanner must not treat persisted desk
 * credentials as an active user session. In-memory attendee cache is cleared
 * so Event A cannot remain visible after lock / switch to Event B.
 *
 * On unlock: bind cache to EventAccessSession.eventId only, then start Sync.
 * Principal also starts upstream check-in reconciliation (23.5b1).
 */
export function registerEventAccessSessionLifecycle(): void {
  if (lifecycleWired) {
    return
  }
  lifecycleWired = true

  onEventAccessUnlocked(() => {
    const session = getEventAccessSession()
    ensureAttendeeCacheForEvent(session?.eventId ?? null)

    if (!isDesktopSyncManagerStarted()) {
      startDesktopSyncManager()
    }
    void maybeAutoStartScannerServer()

    const desk = readDeskCredentialSync()
    if (desk?.role === 'principal') {
      startUpstreamCheckInReconcilerManager()
    } else {
      stopUpstreamCheckInReconcilerManager()
    }
  })

  onEventAccessLocked(() => {
    clearAttendeeCache()
    stopDesktopSyncManager()
    stopUpstreamCheckInReconcilerManager()
    void stopScannerServer()
  })
}
