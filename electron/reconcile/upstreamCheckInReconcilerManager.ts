/**
 * Principal-owned upstream check-in reconciliation (Sprint 23.5b1).
 * Drains FoxBridge Cloud pending/failed-retryable rows via platform adapters.
 * Does not affect operational check-in UX (Cloud-first remains authoritative).
 */
import {
  pullPendingCheckInsViaDesk,
  updateCheckInUpstreamStatusViaDesk,
  type UpstreamStatusWriteback,
} from '../cloud/desktopCloudApi'
import { readDeskCredentialSync } from '../cloud/deskCredentialStore'
import { getEventById } from '../db/eventRepository'
import { getAttendeeCache } from '../scannerServer/attendeeCache'
import {
  getEventAccessSession,
  isEventAccessUnlocked,
} from '../session/eventAccessSession'
import { getUpstreamCheckInReconciler } from './upstreamCheckInRegistry'
import {
  computeUpstreamNextAttemptAt,
  isUpstreamAttemptExhausted,
  type OperationalCheckInWorkItem,
  type UpstreamReconcileResult,
} from './upstreamCheckInTypes'

const INTERVAL_MS = 30_000
const BATCH_LIMIT = 50

let started = false
let inProgress = false
let intervalHandle: ReturnType<typeof setInterval> | null = null
let kickTimer: ReturnType<typeof setTimeout> | null = null

function isPrincipalEligible(): boolean {
  if (!isEventAccessUnlocked()) {
    return false
  }
  const desk = readDeskCredentialSync()
  return desk?.role === 'principal'
}

function toWriteback(
  item: OperationalCheckInWorkItem,
  result: UpstreamReconcileResult,
): UpstreamStatusWriteback | null {
  // Do not burn durable attempts when credentials are temporarily unavailable.
  if (result.errorCode === 'upstream_not_configured') {
    return null
  }

  const attemptCount = item.upstreamAttemptCount + 1

  if (result.status === 'synced') {
    return {
      attendeeId: item.attendeeId,
      upstreamSyncStatus: 'synced',
      upstreamLastErrorCode: null,
      upstreamRetryEligible: false,
      upstreamAttemptCount: attemptCount,
      upstreamNextAttemptAt: null,
    }
  }

  if (result.status === 'not_applicable') {
    return {
      attendeeId: item.attendeeId,
      upstreamSyncStatus: 'not_applicable',
      upstreamLastErrorCode: result.errorCode ?? 'no_upstream_adapter',
      upstreamRetryEligible: false,
      upstreamAttemptCount: attemptCount,
      upstreamNextAttemptAt: null,
    }
  }

  if (result.status === 'failed_terminal') {
    return {
      attendeeId: item.attendeeId,
      upstreamSyncStatus: 'failed',
      upstreamLastErrorCode: result.errorCode ?? 'upstream_terminal',
      upstreamRetryEligible: false,
      upstreamAttemptCount: attemptCount,
      upstreamNextAttemptAt: null,
    }
  }

  // failed_retryable
  if (isUpstreamAttemptExhausted(attemptCount)) {
    return {
      attendeeId: item.attendeeId,
      upstreamSyncStatus: 'failed',
      upstreamLastErrorCode: 'retry_exhausted',
      upstreamRetryEligible: false,
      upstreamAttemptCount: attemptCount,
      upstreamNextAttemptAt: null,
    }
  }

  return {
    attendeeId: item.attendeeId,
    upstreamSyncStatus: 'failed',
    upstreamLastErrorCode: result.errorCode ?? 'upstream_error',
    upstreamRetryEligible: true,
    upstreamAttemptCount: attemptCount,
    upstreamNextAttemptAt: computeUpstreamNextAttemptAt(attemptCount),
  }
}

export async function runUpstreamCheckInReconcileBestEffort(): Promise<void> {
  if (inProgress) {
    return
  }
  if (!isPrincipalEligible()) {
    return
  }

  const session = getEventAccessSession()
  const eventId = session?.eventId?.trim()
  if (!eventId) {
    return
  }

  const event = getEventById(eventId)
  if (!event) {
    return
  }

  inProgress = true
  try {
    const pending = await pullPendingCheckInsViaDesk({ limit: BATCH_LIMIT })
    if (pending.count === 0) {
      return
    }

    const reconciler = getUpstreamCheckInReconciler(event.registrationPlatform)
    const cache = getAttendeeCache()

    const workItems: OperationalCheckInWorkItem[] = pending.checkIns.map((row) => {
      const cached = cache.find((a) => a.id === row.attendeeId)
      return {
        conferenceId: pending.conferenceId,
        attendeeId: row.attendeeId,
        registrationId: row.registrationId,
        checkedInAt: row.checkedInAt,
        confirmationCode: cached?.confirmationCode ?? null,
        upstreamAttemptCount: row.upstreamAttemptCount ?? 0,
      }
    })

    let results: UpstreamReconcileResult[]

    if (!reconciler) {
      results = workItems.map((item) => ({
        attendeeId: item.attendeeId,
        status: 'not_applicable' as const,
        errorCode: 'no_upstream_adapter',
      }))
    } else {
      results = await reconciler.reconcileBatch(workItems, {
        platformEventId: event.platformEventId,
        foxbridgeEventId: event.id,
      })
    }

    const byId = new Map(results.map((r) => [r.attendeeId, r]))
    const writebacks: UpstreamStatusWriteback[] = []
    for (const item of workItems) {
      const result = byId.get(item.attendeeId)
      if (!result) {
        continue
      }
      const row = toWriteback(item, result)
      if (row) {
        writebacks.push(row)
      }
    }

    if (writebacks.length > 0) {
      const updated = await updateCheckInUpstreamStatusViaDesk(writebacks, {
        platformId: reconciler?.platformId ?? event.registrationPlatform,
      })
      console.info(
        '[upstream-check-in-reconcile]',
        JSON.stringify({
          eventId: event.id,
          platform: event.registrationPlatform,
          pulled: pending.count,
          writebacks: writebacks.length,
          updated: updated.updated,
        }),
      )
    }
  } catch (error) {
    console.warn(
      '[upstream-check-in-reconcile]',
      error instanceof Error ? error.message : String(error),
    )
  } finally {
    inProgress = false
  }
}

export function requestUpstreamCheckInReconcileBestEffort(): void {
  if (kickTimer) {
    clearTimeout(kickTimer)
  }
  kickTimer = setTimeout(() => {
    kickTimer = null
    void runUpstreamCheckInReconcileBestEffort()
  }, 750)
  kickTimer.unref?.()
}

export function startUpstreamCheckInReconcilerManager(): void {
  if (started) {
    if (isPrincipalEligible()) {
      void runUpstreamCheckInReconcileBestEffort()
    }
    return
  }

  started = true
  void runUpstreamCheckInReconcileBestEffort()

  intervalHandle = setInterval(() => {
    void runUpstreamCheckInReconcileBestEffort()
  }, INTERVAL_MS)
  intervalHandle.unref?.()
}

export function stopUpstreamCheckInReconcilerManager(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  if (kickTimer) {
    clearTimeout(kickTimer)
    kickTimer = null
  }
  started = false
}

export function isUpstreamCheckInReconcilerManagerStarted(): boolean {
  return started
}
