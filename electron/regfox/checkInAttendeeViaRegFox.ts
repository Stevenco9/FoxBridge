/**
 * RegFox upstream check-in — reserved for Sprint 23.5b Principal reconciliation
 * adapter. Not used by the normal Desktop Check In UI (Cloud-first in 23.5a).
 */
import type { Attendee } from '../../src/shared/models'
import { createRegFoxServiceFromSettings } from './regfoxConfig'

const CHECK_IN_FAILURE_MESSAGE =
  'RegFox could not confirm this check-in. Please try again.'

export interface RegFoxUpstreamCheckInResult {
  success: boolean
  checkedInAt: string | null
  alreadyCheckedIn: boolean
  message: string | null
}

export async function checkInAttendeeViaRegFoxUpstream(
  attendee: Pick<Attendee, 'registrationId' | 'confirmationCode' | 'checkedInAt'>,
): Promise<RegFoxUpstreamCheckInResult> {
  const service = await createRegFoxServiceFromSettings()
  if (!service) {
    return {
      success: false,
      checkedInAt: null,
      alreadyCheckedIn: false,
      message: 'RegFox is not configured.',
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
    console.error('[regfox-check-in-upstream]', JSON.stringify(logPayload))
    return {
      success: false,
      checkedInAt: null,
      alreadyCheckedIn: false,
      message: CHECK_IN_FAILURE_MESSAGE,
    }
  }

  const checkedInAt = result.alreadyCheckedIn
    ? attendee.checkedInAt ?? result.checkedInAt ?? null
    : result.checkedInAt ?? new Date().toISOString()

  return {
    success: true,
    checkedInAt,
    alreadyCheckedIn: result.alreadyCheckedIn,
    message: result.alreadyCheckedIn
      ? 'This attendee was already checked in in RegFox.'
      : null,
  }
}
