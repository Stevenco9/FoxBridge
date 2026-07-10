import type { Attendee } from '../../src/shared/models'
import type { AttendeeCheckInResult } from '../../src/shared/models/AttendeeCheckIn'
import {
  applyPersistedCheckIns,
  persistAttendeeCheckIn,
} from '../db/attendeeCheckInRepository'
import { getAttendeeCache, updateAttendeeInCache } from '../scannerServer/attendeeCache'
import { createRegFoxServiceFromSettings } from './regfoxConfig'

const CHECK_IN_FAILURE_MESSAGE =
  'RegFox could not confirm this check-in. Please try again.'

export async function checkInAttendee(attendeeId: string): Promise<AttendeeCheckInResult> {
  const attendee = getAttendeeCache().find((entry) => entry.id === attendeeId)
  if (!attendee) {
    return {
      success: false,
      attendee: null,
      alreadyCheckedIn: false,
      message: 'Attendee not found.',
    }
  }

  const service = await createRegFoxServiceFromSettings()
  if (!service) {
    console.error(
      '[regfox-check-in]',
      JSON.stringify({ httpStatus: null, message: 'RegFox is not configured.' }),
    )
    return {
      success: false,
      attendee: null,
      alreadyCheckedIn: false,
      message: CHECK_IN_FAILURE_MESSAGE,
    }
  }

  const result = await service.checkInRegistrant({
    registrationId: attendee.registrationId,
    confirmationCode: attendee.confirmationCode ?? null,
  })

  if (!result.success) {
    const logPayload = result.diagnosis ?? {
      httpStatus: result.httpStatus,
      message: result.message,
    }
    console.error('[regfox-check-in]', JSON.stringify(logPayload))
    return {
      success: false,
      attendee: null,
      alreadyCheckedIn: false,
      message: CHECK_IN_FAILURE_MESSAGE,
    }
  }

  const checkedInAt = result.alreadyCheckedIn
    ? attendee.checkedInAt ?? result.checkedInAt
    : result.checkedInAt ?? new Date().toISOString()
  const updated: Attendee = {
    ...attendee,
    checkedIn: true,
    checkedInAt,
    updatedAt: new Date().toISOString(),
  }

  updateAttendeeInCache(updated)
  if (checkedInAt) {
    persistAttendeeCheckIn({
      attendeeId: attendee.id,
      registrationId: attendee.registrationId,
      checkedInAt,
    })
  }

  return {
    success: true,
    attendee: updated,
    alreadyCheckedIn: result.alreadyCheckedIn,
    message: result.alreadyCheckedIn
      ? 'This attendee was already checked in in RegFox.'
      : null,
  }
}

export function mergeAttendeesWithPersistedCheckIns(attendees: Attendee[]): Attendee[] {
  return applyPersistedCheckIns(attendees)
}
