/**
 * Pure helpers for Sprint 23.2 same-install Principal reactivation credential lifecycle.
 * Keeps Desktop claim persistence / reactivation offer rules testable without Electron.
 */

export type LocalDeskRole = 'principal' | 'linked' | 'legacy' | null

export interface LocalDeskCredentialSnapshot {
  deskToken: string
  deskDeviceId: string
  conferenceId: string
  role: LocalDeskRole
}

/**
 * Offer local desk token for Edge reactivation after RegFox proof.
 * Linked tokens must never participate (possession must not escalate).
 * Null local role still offers the token so a missing role field cannot skip
 * reactivation and force a false transfer when Cloud still holds this Principal.
 */
export function selectReactivateDeskToken(input: {
  deskToken: string | null | undefined
  role: LocalDeskRole | undefined
}): string | undefined {
  const token = input.deskToken?.trim()
  if (!token) {
    return undefined
  }
  if (input.role === 'linked') {
    return undefined
  }
  return token
}

export interface ClaimedPrincipalCredential {
  deskToken: string
  deskDeviceId: string
  conferenceId: string
}

/** True when persisted secrets match the Cloud claim/reactivation response. */
export function principalCredentialPersistedMatches(
  persisted: LocalDeskCredentialSnapshot | null | undefined,
  claimed: ClaimedPrincipalCredential,
): boolean {
  if (!persisted) {
    return false
  }
  return (
    persisted.deskToken === claimed.deskToken &&
    persisted.deskDeviceId === claimed.deskDeviceId &&
    persisted.conferenceId === claimed.conferenceId &&
    persisted.role === 'principal'
  )
}

/**
 * Simulate process restart + reactivation token rotation for regression tests:
 * old token must not equal the rotated credential Cloud returns.
 */
export function rotatedPrincipalCredentialReplacesPrior(input: {
  priorToken: string
  rotatedToken: string
}): boolean {
  const prior = input.priorToken.trim()
  const rotated = input.rotatedToken.trim()
  return Boolean(prior && rotated && prior !== rotated)
}
