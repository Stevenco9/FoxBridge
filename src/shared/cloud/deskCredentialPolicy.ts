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

/** Principal-issued Linked join codes: 5–30 minutes (default 15). */
export function isJoinCodeTtlMinutesValid(ttlMinutes: number): boolean {
  return Number.isFinite(ttlMinutes) && ttlMinutes >= 5 && ttlMinutes <= 30
}

export const DEFAULT_JOIN_CODE_TTL_MINUTES = 15
export const LINKED_DESK_CREDENTIAL_HOURS = 48

export function normalizeEnrollmentCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

/**
 * Canonical Linked join code: XXXX-XXXX-XXXX (12 hex chars).
 * Accepts dashed/undashed, mixed case, and hyphens/spaces as separators.
 * Returns null when the input is not a valid 12-hex join code.
 */
export function canonicalizeJoinCode(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/[\s\-]+/g, '')
  if (!/^[0-9A-F]{12}$/.test(compact)) {
    return null
  }
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`
}

/** Formats a join code for hashing / RPC; empty string if invalid. */
export function normalizeJoinCode(raw: string): string {
  return canonicalizeJoinCode(raw) ?? ''
}

/** Live join-code countdown from server expires_at (UI only; does not extend TTL). */
export function formatJoinCodeRemaining(
  expiresAtIso: string,
  nowMs: number = Date.now(),
): { expired: boolean; remainingSeconds: number; mmss: string } {
  const expiresMs = new Date(expiresAtIso).getTime()
  if (!Number.isFinite(expiresMs)) {
    return { expired: true, remainingSeconds: 0, mmss: '0:00' }
  }
  const remainingSeconds = Math.max(0, Math.ceil((expiresMs - nowMs) / 1000))
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  return {
    expired: remainingSeconds <= 0,
    remainingSeconds,
    mmss: `${minutes}:${String(seconds).padStart(2, '0')}`,
  }
}

/** Opaque installation IDs are UUIDs — identity only, never credentials. */
export function isFoxBridgeInstallationId(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
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
