/**
 * Principal-only upstream check-in health presentation (Sprint 23.5b2).
 * Pure helpers — no Electron. Platform-neutral copy keys.
 */

export type UpstreamCheckInHealthLevel = 'healthy' | 'soft_pending' | 'attention' | 'hidden'

export interface UpstreamCheckInHealthCounts {
  pending: number
  failedRetryable: number
  terminalOrExhausted: number
  oldestWaitingAt?: string | null
}

/** Short-lived waiting rows stay "healthy" until this age (ms). */
export const UPSTREAM_SOFT_PENDING_THRESHOLD_MS = 90_000

export function resolveUpstreamCheckInHealthLevel(
  counts: UpstreamCheckInHealthCounts,
  nowMs: number = Date.now(),
): UpstreamCheckInHealthLevel {
  const attention = Math.max(0, counts.terminalOrExhausted)
  if (attention > 0) {
    return 'attention'
  }

  const waiting = Math.max(0, counts.pending) + Math.max(0, counts.failedRetryable)
  if (waiting <= 0) {
    return 'healthy'
  }

  const oldest = counts.oldestWaitingAt?.trim()
  if (!oldest) {
    return 'soft_pending'
  }

  const oldestMs = Date.parse(oldest)
  if (Number.isNaN(oldestMs)) {
    return 'soft_pending'
  }

  if (nowMs - oldestMs < UPSTREAM_SOFT_PENDING_THRESHOLD_MS) {
    // Normal short-lived pending — do not alarm.
    return 'healthy'
  }

  return 'soft_pending'
}

export function formatUpstreamCheckInHealthMessage(
  level: UpstreamCheckInHealthLevel,
  counts: UpstreamCheckInHealthCounts,
  t: (key: string, values?: Record<string, string | number>) => string,
): string | null {
  if (level === 'hidden') {
    return null
  }

  if (level === 'attention') {
    const n = Math.max(0, counts.terminalOrExhausted)
    return t('sync.upstream.attention', { count: n })
  }

  if (level === 'soft_pending') {
    const n = Math.max(0, counts.pending) + Math.max(0, counts.failedRetryable)
    return t('sync.upstream.pending', { count: n })
  }

  return t('sync.upstream.ok')
}
