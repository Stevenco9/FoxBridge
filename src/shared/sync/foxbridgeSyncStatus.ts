/**
 * Organizer-facing FoxBridge Sync enrollment status (Sprint 21.8 / 22.2).
 * Pure helpers shared by Setup Wizard and Operations Home.
 */

export type FoxBridgeSyncUiPhase =
  | 'ready_to_setup'
  | 'connecting'
  | 'connected'
  | 'confirm_transfer'
  | 'verification_failed'
  | 'cloud_unavailable'
  | 'needs_retry'
  | 'enter_code'
  | 'invalid_code'
  | 'expired_code'
  | 'revoked'
  | 'needs_reenrollment'
  | 'not_connected'

export type FoxBridgeSyncIssueKind =
  | 'none'
  | 'invalid_code'
  | 'expired_code'
  | 'revoked'
  | 'needs_reenrollment'
  | 'verification_failed'
  | 'cloud_unavailable'
  | 'unavailable'

export type FoxBridgeSyncDeskRoleLabel = 'principal' | 'legacy' | 'linked' | 'unknown'

/** Map Edge / enroll / claim error text into an organizer-safe issue kind. */
export function classifyFoxBridgeSyncIssue(
  message: string | null | undefined,
): FoxBridgeSyncIssueKind {
  const text = (message ?? '').toLowerCase()
  if (!text.trim()) {
    return 'none'
  }

  if (text.includes('revoked')) {
    return 'revoked'
  }

  if (text.includes('expired') && (text.includes('credential') || text.includes('desk'))) {
    return 'needs_reenrollment'
  }

  if (text.includes('expired') && (text.includes('enrollment') || text.includes('connection'))) {
    return 'expired_code'
  }

  if (text.includes('already been used')) {
    return 'invalid_code'
  }

  if (
    (text.includes('invalid') && text.includes('enrollment')) ||
    (text.includes('invalid') && text.includes('connection')) ||
    text.includes('connection code') ||
    text.includes('enrollment code') ||
    text.includes('unable to connect with that code') ||
    text.includes('did not work')
  ) {
    return 'invalid_code'
  }

  if (text.includes('invalid') && text.includes('installation')) {
    return 'unavailable'
  }

  if (text.includes('check constraint') || text.includes('linked_desktop_rejoined')) {
    return 'unavailable'
  }

  if (text.includes('invalid') && text.includes('credential')) {
    return 'needs_reenrollment'
  }

  if (
    text.includes('regfox') ||
    text.includes('could not verify') ||
    text.includes('unable to verify') ||
    text.includes('verification failed') ||
    text.includes('api key') ||
    text.includes('unauthorized') ||
    text.includes('forbidden')
  ) {
    return 'verification_failed'
  }

  if (
    text.includes('fetch failed') ||
    text.includes('network') ||
    text.includes('econnrefused') ||
    text.includes('enotfound') ||
    text.includes('timed out') ||
    text.includes('timeout') ||
    text.includes('cloud request failed') ||
    text.includes('failed to fetch')
  ) {
    return 'cloud_unavailable'
  }

  // Deterministic join/redeem failures (including migration diagnostics) are not
  // generic Cloud outages — keep them off the cloud_unavailable path.
  if (
    text.includes('unable to connect with that code') ||
    text.includes('migration 014') ||
    text.includes('migration 015') ||
    text.includes('ambiguous')
  ) {
    return 'invalid_code'
  }

  if (text.includes('unavailable')) {
    return 'cloud_unavailable'
  }

  return 'unavailable'
}

export function resolveFoxBridgeSyncPhase(input: {
  isConnecting: boolean
  codeEntryVisible: boolean
  needsTransferConfirmation: boolean
  deskCredentialConfigured: boolean
  connected: boolean
  connectionError: string | null | undefined
  enrollError: string | null | undefined
}): FoxBridgeSyncUiPhase {
  if (input.isConnecting) {
    return 'connecting'
  }

  if (input.connected) {
    return 'connected'
  }

  if (input.needsTransferConfirmation) {
    return 'confirm_transfer'
  }

  const issue = classifyFoxBridgeSyncIssue(input.enrollError ?? input.connectionError)

  if (issue === 'revoked') {
    return 'revoked'
  }
  if (issue === 'expired_code') {
    return 'expired_code'
  }
  if (issue === 'invalid_code') {
    return 'invalid_code'
  }
  if (issue === 'needs_reenrollment') {
    return 'needs_reenrollment'
  }
  if (issue === 'verification_failed') {
    return 'verification_failed'
  }
  if (issue === 'cloud_unavailable') {
    return 'cloud_unavailable'
  }

  // While the join/setup form is open, surface unclassified errors instead of
  // silently redisplaying an empty enter_code state.
  if (input.codeEntryVisible) {
    if (input.enrollError && (issue === 'unavailable' || issue === 'none')) {
      return 'needs_retry'
    }
    return 'enter_code'
  }

  if (input.deskCredentialConfigured && !input.connected) {
    return 'needs_reenrollment'
  }

  if (input.enrollError && issue === 'unavailable') {
    return 'needs_retry'
  }

  return 'ready_to_setup'
}

/** Organizer status row label kind for Operations Home (Sprint 22.2/22.3). */
export function resolveFoxBridgeSyncHomeStatus(input: {
  connected: boolean
  enrolled: boolean
  deskRole: string | null | undefined
  deskExpiresAt?: string | null | undefined
  connectionError: string | null | undefined
}):
  | 'connected_principal'
  | 'connected_legacy'
  | 'connected_linked'
  | 'connected'
  | 'reconnect'
  | 'not_connected' {
  if (input.connected) {
    if (input.deskRole === 'principal') {
      return 'connected_principal'
    }
    if (input.deskRole === 'linked') {
      return 'connected_linked'
    }
    if (input.deskRole === 'legacy') {
      return 'connected_legacy'
    }
    return 'connected'
  }

  const issue = classifyFoxBridgeSyncIssue(input.connectionError)
  if (
    input.enrolled ||
    issue === 'revoked' ||
    issue === 'needs_reenrollment' ||
    (input.deskRole === 'linked' &&
      input.deskExpiresAt &&
      new Date(input.deskExpiresAt).getTime() <= Date.now())
  ) {
    return 'reconnect'
  }

  return 'not_connected'
}

/**
 * Principal-only Connected Desktops entry point (Operations Home).
 * Re-evaluate after Sync credential/role refresh — do not cache across enroll/claim.
 */
export function shouldShowConnectedDesksAction(input: {
  foxbridgeSyncConnected: boolean | null | undefined
  foxbridgeSyncDeskRole: string | null | undefined
}): boolean {
  return Boolean(
    input.foxbridgeSyncConnected && input.foxbridgeSyncDeskRole === 'principal',
  )
}

/**
 * Operations Home must re-read SetupStatus when Sync credentials change
 * (claim, join, enroll, reconnect) — not only when attendee count changes.
 */
export function buildOperationsHomeRefreshToken(input: {
  attendeeCount: number
  syncCredentialEpoch: number
}): string {
  return `${input.attendeeCount}:${input.syncCredentialEpoch}`
}

export function normalizeDeskRoleLabel(
  role: string | null | undefined,
): FoxBridgeSyncDeskRoleLabel {
  if (role === 'principal') {
    return 'principal'
  }
  if (role === 'linked') {
    return 'linked'
  }
  if (role === 'legacy') {
    return 'legacy'
  }
  return 'unknown'
}

export function formatLinkedConnectedUntil(
  expiresAt: string | null | undefined,
  locale?: string,
): string {
  if (!expiresAt) {
    return ''
  }
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Organizer-safe copy keys are resolved by the UI via i18n; these are fallbacks. */
export function foxBridgeSyncIssueFallbackMessage(issue: FoxBridgeSyncIssueKind): string {
  switch (issue) {
    case 'invalid_code':
      return 'That code did not work. Check the code and try again, or ask for a new one.'
    case 'expired_code':
      return 'That code has expired. Ask for a new enrollment code and try again.'
    case 'revoked':
      return 'This computer’s conference connection was revoked. Enter a new enrollment code to reconnect.'
    case 'needs_reenrollment':
      return 'This computer needs to reconnect to FoxBridge Sync. Enter a new enrollment code.'
    case 'verification_failed':
      return 'FoxBridge could not verify RegFox access for this event. Check your RegFox connection and try again.'
    case 'cloud_unavailable':
      return 'FoxBridge Sync is temporarily unavailable. Try again in a moment.'
    case 'unavailable':
      return 'Unable to connect to FoxBridge Sync right now. Try again in a moment.'
    default:
      return ''
  }
}

/**
 * Renderer-facing claim/enroll result must never include RegFox API key fields.
 * Used by tests to assert IPC/result shapes stay safe.
 */
export function assertNoRegFoxApiKeyInObject(value: unknown, path = 'root'): void {
  if (value === null || value === undefined) {
    return
  }
  if (typeof value !== 'object') {
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRegFoxApiKeyInObject(item, `${path}[${index}]`))
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase()
    if (
      lower.includes('regfoxapikey') ||
      lower === 'apikey' ||
      lower === 'api_key' ||
      lower === 'regfox_api_key'
    ) {
      throw new Error(`RegFox API key field exposed at ${path}.${key}`)
    }
    assertNoRegFoxApiKeyInObject(child, `${path}.${key}`)
  }
}
