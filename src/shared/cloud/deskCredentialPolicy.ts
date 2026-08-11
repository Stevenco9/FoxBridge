/**
 * Pure authorization helpers for FoxBridge Cloud desk credentials (Sprint 21.6).
 */

export type CloudOpsTransport = 'desk_credential' | 'legacy_service_role' | 'none'

export function resolveCloudOpsTransport(input: {
  publicConfigured: boolean
  deskTokenPresent: boolean
  legacyPrivilegedKeyPresent: boolean
}): CloudOpsTransport {
  if (!input.publicConfigured) {
    return 'none'
  }

  if (input.deskTokenPresent) {
    return 'desk_credential'
  }

  if (input.legacyPrivilegedKeyPresent) {
    return 'legacy_service_role'
  }

  return 'none'
}

/** Enrollment codes are single-use and short-lived (5 minutes–24 hours). */
export function isEnrollmentTtlMinutesValid(ttlMinutes: number): boolean {
  return Number.isFinite(ttlMinutes) && ttlMinutes >= 5 && ttlMinutes <= 24 * 60
}

export function normalizeEnrollmentCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

/**
 * Event isolation: a desk bound to conference A must not mutate conference B.
 */
export function isConferenceAuthorizedForDesk(input: {
  deskConferenceId: string
  requestedConferenceId: string | null | undefined
}): boolean {
  const requested = input.requestedConferenceId?.trim()
  if (!requested) {
    return true
  }
  return requested === input.deskConferenceId.trim()
}
