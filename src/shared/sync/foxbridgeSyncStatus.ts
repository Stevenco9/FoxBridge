/**
 * Organizer-facing FoxBridge Sync enrollment status (Sprint 21.8).
 * Pure helpers shared by Setup Wizard and Operations Home.
 */

export type FoxBridgeSyncUiPhase =
  | 'not_connected'
  | 'enter_code'
  | 'connecting'
  | 'connected'
  | 'invalid_code'
  | 'expired_code'
  | 'revoked'
  | 'needs_reenrollment'

export type FoxBridgeSyncIssueKind =
  | 'none'
  | 'invalid_code'
  | 'expired_code'
  | 'revoked'
  | 'needs_reenrollment'
  | 'unavailable'

/** Map Edge / enroll error text into an organizer-safe issue kind. */
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

  if (text.includes('expired') && text.includes('enrollment')) {
    return 'expired_code'
  }

  if (text.includes('already been used')) {
    return 'invalid_code'
  }

  if (text.includes('invalid') && text.includes('enrollment')) {
    return 'invalid_code'
  }

  if (text.includes('invalid') && text.includes('credential')) {
    return 'needs_reenrollment'
  }

  if (text.includes('enrollment code')) {
    return 'invalid_code'
  }

  return 'unavailable'
}

export function resolveFoxBridgeSyncPhase(input: {
  isConnecting: boolean
  codeEntryVisible: boolean
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

  if (input.codeEntryVisible) {
    return 'enter_code'
  }

  if (input.deskCredentialConfigured && !input.connected) {
    return 'needs_reenrollment'
  }

  return 'not_connected'
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
    case 'unavailable':
      return 'Unable to connect to FoxBridge Sync right now. Try again in a moment.'
    default:
      return ''
  }
}
