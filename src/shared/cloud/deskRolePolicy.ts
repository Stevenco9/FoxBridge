/**
 * Pure helpers for Principal / Linked / legacy desk roles (Sprint 22.1).
 */

export type DeskDeviceRole = 'principal' | 'linked' | 'legacy'

export type RegistrationPlatform = 'regfox'

export function isDeskDeviceRole(value: string | null | undefined): value is DeskDeviceRole {
  return value === 'principal' || value === 'linked' || value === 'legacy'
}

/** Sprint 21 operator-enrolled devices migrate to legacy. */
export function defaultMigratedDeskRole(): DeskDeviceRole {
  return 'legacy'
}

/**
 * Desk ops used by Sprint 21 (publish, pairing, resolve conference).
 * Principal, Linked (while valid), and legacy all may perform these.
 */
export function canPerformStandardDeskOps(role: DeskDeviceRole): boolean {
  return role === 'principal' || role === 'linked' || role === 'legacy'
}

/**
 * Principal-only management (join codes, list/revoke Linked) — Sprint 22.3.
 * Legacy intentionally cannot manage devices (operator fallback desks).
 */
export function canManageLinkedDesks(role: DeskDeviceRole): boolean {
  return role === 'principal'
}

/** Linked desks may use ordinary desk ops only while not expired/revoked. */
export function isLinkedCredentialStillValid(input: {
  role: DeskDeviceRole
  expiresAt: string | null | undefined
  revokedAt?: string | null
  nowMs?: number
}): boolean {
  if (input.role !== 'linked') {
    return true
  }
  if (input.revokedAt) {
    return false
  }
  if (!input.expiresAt) {
    return false
  }
  const now = input.nowMs ?? Date.now()
  return new Date(input.expiresAt).getTime() > now
}

export function canClaimOrTransferPrincipal(role: DeskDeviceRole | null): boolean {
  // Claim is ownership-verify, not desk-token based. Kept for matrix clarity.
  void role
  return true
}

/**
 * Organizer may upgrade a Sprint 21 legacy desk to Principal via RegFox ownership
 * proof (Sprint 22.4). Linked desks must never use Linked authority — or a silent
 * reuse of stored RegFox secrets after a Linked join — to elevate.
 */
export function shouldOfferPrincipalUpgradeAction(
  role: DeskDeviceRole | null | undefined,
): boolean {
  return role === 'legacy'
}

/**
 * Silent Principal claim may reuse locally stored RegFox secrets ONLY for an
 * already-legacy desk that connected RegFox as its own setup path.
 * Linked / unknown / principal-absent roles must supply fresh ownership credentials.
 */
export function canSilentPrincipalClaimFromStoredRegFox(
  role: DeskDeviceRole | null | undefined,
): boolean {
  return role === 'legacy'
}

/** Linked history must never authorize Principal by possession alone. */
export function linkedCanBecomePrincipalByPossessionAlone(): boolean {
  return false
}

export function normalizeExternalEventId(raw: string): string {
  return raw.trim()
}

export function normalizeRegistrationPlatform(raw: string): RegistrationPlatform | null {
  const value = raw.trim().toLowerCase()
  if (value === 'regfox') {
    return 'regfox'
  }
  return null
}

export function buildCanonicalEventKey(
  platform: RegistrationPlatform,
  externalEventId: string,
): string {
  return `${platform}:${normalizeExternalEventId(externalEventId)}`
}

/**
 * Sanitize error text so API keys / long tokens are not echoed to clients or logs.
 */
export function sanitizeUpstreamErrorMessage(message: string | null | undefined): string {
  if (!message) {
    return 'Request failed.'
  }
  let text = message
  text = text.replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/gi, '[redacted]')
  text = text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]')
  // Long hex-ish secrets
  text = text.replace(/\b[a-f0-9]{32,}\b/gi, '[redacted]')
  // Common header leakage patterns
  text = text.replace(/apiKey["']?\s*[:=]\s*["']?[^"',\s]+/gi, 'apiKey=[redacted]')
  return text.slice(0, 300)
}
