/**
 * Platform-neutral upstream check-in reconciliation contracts (Sprint 23.5b1).
 * RegFox-specific behavior lives only inside the RegFox adapter.
 */

export type UpstreamReconcileOutcomeStatus =
  | 'synced'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'not_applicable'

export interface OperationalCheckInWorkItem {
  conferenceId: string
  attendeeId: string
  registrationId: string
  checkedInAt: string
  confirmationCode?: string | null
  upstreamAttemptCount: number
}

export interface UpstreamReconcileResult {
  attendeeId: string
  status: UpstreamReconcileOutcomeStatus
  /** Safe normalized code only — never raw upstream bodies or secrets. */
  errorCode?: string | null
}

export interface UpstreamReconcileContext {
  /** Upstream event/page/form id from trusted local Event identity. */
  platformEventId: string
  foxbridgeEventId: string
}

export interface UpstreamCheckInReconciler {
  readonly platformId: string
  reconcileBatch(
    items: OperationalCheckInWorkItem[],
    context: UpstreamReconcileContext,
  ): Promise<UpstreamReconcileResult[]>
}

/** Durable backoff helpers — no in-memory Principal state required. */
export const UPSTREAM_MAX_ATTEMPTS = 20
export const UPSTREAM_BACKOFF_BASE_MS = 30_000
export const UPSTREAM_BACKOFF_CAP_MS = 5 * 60_000

export function computeUpstreamNextAttemptAt(attemptCountAfterThisTry: number): string {
  const exp = Math.min(Math.max(attemptCountAfterThisTry - 1, 0), 4)
  const delayMs = Math.min(
    UPSTREAM_BACKOFF_CAP_MS,
    UPSTREAM_BACKOFF_BASE_MS * 2 ** exp,
  )
  return new Date(Date.now() + delayMs).toISOString()
}

export function isUpstreamAttemptExhausted(attemptCountAfterThisTry: number): boolean {
  return attemptCountAfterThisTry >= UPSTREAM_MAX_ATTEMPTS
}
