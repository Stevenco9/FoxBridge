import { shouldReplaceLocalAttendeesFromCloudSnapshot } from '../../src/shared/attendees/cloudAttendeeSnapshotAuthority'
import { isDeskDeviceRole } from '../../src/shared/cloud/deskRolePolicy'
import { readDeskCredentialSync } from '../cloud/deskCredentialStore'
import { getEventAccessSession } from '../session/eventAccessSession'
import { readSecrets } from '../settings/secretStore'
import { readPublicSettings } from '../settings/settingsStore'

/**
 * Live Desktop decision: may Cloud attendee snapshot replace Local Event Store
 * for the current session? Principal / RegFox-authoritative desks always false.
 */
export async function mayReplaceLocalAttendeesFromCloudSnapshot(): Promise<boolean> {
  const desk = readDeskCredentialSync()
  const session = getEventAccessSession()
  const [secrets, settings] = await Promise.all([readSecrets(), readPublicSettings()])

  const hasRegFoxRegistrationAuthority = Boolean(
    secrets.regfoxApiKey?.trim() && settings.regfoxEventId?.trim(),
  )

  const deskRole = isDeskDeviceRole(desk?.role) ? desk.role : null

  return shouldReplaceLocalAttendeesFromCloudSnapshot({
    deskRole,
    unlockMethod: session?.unlockMethod ?? null,
    hasRegFoxRegistrationAuthority,
  })
}
