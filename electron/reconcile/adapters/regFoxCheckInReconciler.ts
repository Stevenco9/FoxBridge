/**
 * RegFox upstream check-in adapter (Sprint 23.5b1).
 * Uses Principal-local RegFox credentials only. Never called from Linked UI path.
 */
import { createRegFoxServiceFromSettings } from '../../regfox/regfoxConfig'
import type {
  OperationalCheckInWorkItem,
  UpstreamCheckInReconciler,
  UpstreamReconcileContext,
  UpstreamReconcileResult,
} from '../upstreamCheckInTypes'

function mapRegFoxFailure(
  httpStatus: number | null,
  message: string,
): UpstreamReconcileResult['status'] {
  const lower = message.toLowerCase()
  if (
    lower.includes('registrant id is missing') ||
    (lower.includes('missing') && lower.includes('id'))
  ) {
    return 'failed_terminal'
  }
  if (httpStatus === 404) {
    return 'failed_terminal'
  }
  if (httpStatus === 400 || httpStatus === 422) {
    // Malformed / invalid registration — do not hammer.
    return 'failed_terminal'
  }
  return 'failed_retryable'
}

function safeErrorCode(
  status: UpstreamReconcileResult['status'],
  httpStatus: number | null,
): string {
  if (status === 'failed_terminal') {
    if (httpStatus === 404) return 'upstream_not_found'
    if (httpStatus === 400 || httpStatus === 422) return 'invalid_registration_id'
    return 'invalid_registration_id'
  }
  if (httpStatus === 401 || httpStatus === 403) return 'upstream_auth_error'
  if (httpStatus === 429) return 'upstream_rate_limit'
  if (httpStatus != null && httpStatus >= 500) return 'upstream_5xx'
  if (httpStatus == null) return 'network_error'
  return 'upstream_error'
}

export const regFoxCheckInReconciler: UpstreamCheckInReconciler = {
  platformId: 'regfox',

  async reconcileBatch(
    items: OperationalCheckInWorkItem[],
    _context: UpstreamReconcileContext,
  ): Promise<UpstreamReconcileResult[]> {
    const service = await createRegFoxServiceFromSettings()
    if (!service) {
      // Leave pending — do not mark failed; Principal may still unlock credentials.
      console.warn(
        '[regfox-check-in-reconciler]',
        JSON.stringify({ message: 'RegFox not configured; skipping batch.' }),
      )
      return items.map((item) => ({
        attendeeId: item.attendeeId,
        status: 'failed_retryable' as const,
        errorCode: 'upstream_not_configured',
      }))
    }

    const results: UpstreamReconcileResult[] = []

    for (const item of items) {
      const result = await service.checkInRegistrant({
        registrationId: item.registrationId,
        confirmationCode: item.confirmationCode ?? null,
      })

      if (result.success) {
        // Includes already-checked-in (RegFox code 8500) → synced.
        results.push({
          attendeeId: item.attendeeId,
          status: 'synced',
          errorCode: result.alreadyCheckedIn ? 'already_checked_in' : null,
        })
        console.info(
          '[regfox-check-in-reconciler]',
          JSON.stringify({
            attendeeId: item.attendeeId,
            synced: true,
            alreadyCheckedIn: result.alreadyCheckedIn,
          }),
        )
        continue
      }

      const outcome = mapRegFoxFailure(result.httpStatus, result.message)
      const errorCode = safeErrorCode(outcome, result.httpStatus)
      console.warn(
        '[regfox-check-in-reconciler]',
        JSON.stringify({
          attendeeId: item.attendeeId,
          outcome,
          errorCode,
          httpStatus: result.httpStatus,
        }),
      )
      results.push({
        attendeeId: item.attendeeId,
        status: outcome,
        errorCode,
      })
    }

    return results
  },
}
