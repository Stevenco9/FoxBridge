import type { Attendee } from '../../shared/models'

const EPHEMERAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isStableAttendeeId(attendee: Attendee): boolean {
  const id = attendee.id.trim()
  if (!id) {
    return false
  }

  if (EPHEMERAL_UUID_PATTERN.test(id)) {
    return false
  }

  const registrationId = attendee.registrationId.trim()
  if (registrationId && id === registrationId) {
    return true
  }

  return !EPHEMERAL_UUID_PATTERN.test(id)
}

/**
 * Returns the stable identifier encoded in badge QR codes.
 * Uses only attendee ids suitable for future scanner lookup.
 */
export function getAttendeeQrValue(attendee: Attendee): string {
  if (isStableAttendeeId(attendee)) {
    return attendee.id.trim()
  }

  const confirmationCode = attendee.confirmationCode?.trim()
  if (confirmationCode) {
    return confirmationCode
  }

  const registrationId = attendee.registrationId.trim()
  if (registrationId) {
    return registrationId
  }

  return attendee.id.trim()
}
