import type { DeskDeviceRole } from '../cloud/deskRolePolicy'
import type { EventUnlockMethod } from '../models/EventAccessSession'

/**
 * Whether Cloud → Local Event Store attendee snapshot replace is allowed.
 *
 * Principal: NEVER — RegFox is registration authority; Cloud is a sanitized projection.
 * Linked: YES — Cloud snapshot is the only registration source.
 * Legacy:
 * - With RegFox authority → NEVER (same downgrade risk as Principal).
 * - Cloud-only legacy enroll → YES (Linked-like; no RegFox dataset to protect).
 */
export function shouldReplaceLocalAttendeesFromCloudSnapshot(input: {
  deskRole: DeskDeviceRole | null | undefined
  unlockMethod?: EventUnlockMethod | null
  /** Local RegFox API key + event id available for registration authority. */
  hasRegFoxRegistrationAuthority?: boolean
}): boolean {
  const role = input.deskRole
  const method = input.unlockMethod ?? null

  // Session unlocked as Principal / RegFox ownership — never Cloud-replace.
  if (method === 'principal' || method === 'regfox') {
    return false
  }

  if (role === 'linked' || method === 'linked') {
    return true
  }

  if (role === 'principal') {
    return false
  }

  if (role === 'legacy' || method === 'legacy') {
    if (input.hasRegFoxRegistrationAuthority === true) {
      return false
    }
    // Cloud-only legacy desk: snapshot pull is the registration source.
    return true
  }

  // Unknown / missing role — fail closed (do not downgrade).
  return false
}
