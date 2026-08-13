import type { Attendee } from '../../src/shared/models'
import type { AttendeeCheckInResult } from '../../src/shared/models/AttendeeCheckIn'
import {
  applyPersistedCheckIns,
  persistEventAttendeeCheckIn,
} from '../db/attendeeCheckInRepository'
import {
  getAttendeeCache,
  getAttendeeCacheEventId,
  patchAttendeeCheckInInCache,
} from '../scannerServer/attendeeCache'
import { getEventAccessSession } from '../session/eventAccessSession'
import { checkInAttendeeViaDesk } from '../cloud/desktopCloudApi'
import { readDeskCredentialSync } from '../cloud/deskCredentialStore'
import { notifyAttendeesChanged } from '../ui/notifyAttendeesChanged'

const CHECK_IN_FAILURE_MESSAGE =
  'Unable to check in right now. Please try again.'

/**
 * Sprint 23.5a — Cloud-first operational check-in for Principal and Linked.
 * Does not call RegFox. Upstream reconciliation is Sprint 23.5b.
 */
export async function checkInAttendee(attendeeId: string): Promise<AttendeeCheckInResult> {
  const session = getEventAccessSession()
  const sessionEventId = session?.eventId?.trim()
  if (!sessionEventId || getAttendeeCacheEventId() !== sessionEventId) {
    return {
      success: false,
      attendee: null,
      alreadyCheckedIn: false,
      message: 'Attendee not found.',
    }
  }

  const attendee = getAttendeeCache().find(
    (entry) =>
      entry.id === attendeeId &&
      (!entry.eventId?.trim() || entry.eventId.trim() === sessionEventId),
  )
  if (!attendee) {
    return {
      success: false,
      attendee: null,
      alreadyCheckedIn: false,
      message: 'Attendee not found.',
    }
  }

  try {
    const cloud = await checkInAttendeeViaDesk(attendee.id)

    if (
      cloud.conferenceId &&
      sessionEventId &&
      session?.conferenceId &&
      cloud.conferenceId !== session.conferenceId
    ) {
      console.warn(
        '[cloud-check-in]',
        JSON.stringify({
          eventId: sessionEventId,
          attendeeId: attendee.id,
          message: 'Cloud conference mismatch — refusing local apply.',
        }),
      )
      return {
        success: false,
        attendee: null,
        alreadyCheckedIn: false,
        message: CHECK_IN_FAILURE_MESSAGE,
      }
    }

    const checkedInAt = cloud.checkedInAt
    persistEventAttendeeCheckIn({
      eventId: sessionEventId,
      attendeeId: attendee.id,
      registrationId: cloud.registrationId || attendee.registrationId,
      checkedIn: true,
      checkedInAt,
      source: cloud.source || 'desktop',
      updatedAt: cloud.updatedAt || checkedInAt,
    })

    const updated = patchAttendeeCheckInInCache({
      attendeeId: attendee.id,
      eventId: sessionEventId,
      checkedIn: true,
      checkedInAt,
    })

    console.info(
      '[cloud-check-in]',
      JSON.stringify({
        eventId: sessionEventId,
        conferenceId: cloud.conferenceId,
        attendeeId: attendee.id,
        alreadyCheckedIn: cloud.alreadyCheckedIn,
        checkedInAt,
        upstreamSyncStatus: cloud.upstreamSyncStatus,
      }),
    )

    notifyAttendeesChanged()

    // Operational success is Cloud-first; Principal may kick upstream drain
    // without blocking the operator (Sprint 23.5b1).
    const desk = readDeskCredentialSync()
    if (desk?.role === 'principal') {
      void import('../reconcile/upstreamCheckInReconcilerManager').then(
        ({ requestUpstreamCheckInReconcileBestEffort }) => {
          requestUpstreamCheckInReconcileBestEffort()
        },
      )
    }

    return {
      success: true,
      attendee: updated ?? {
        ...attendee,
        checkedIn: true,
        checkedInAt,
      },
      alreadyCheckedIn: cloud.alreadyCheckedIn,
      message: cloud.alreadyCheckedIn ? 'This attendee was already checked in.' : null,
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : CHECK_IN_FAILURE_MESSAGE

    console.warn(
      '[cloud-check-in]',
      JSON.stringify({
        eventId: sessionEventId,
        attendeeId: attendee.id,
        message: message.slice(0, 200),
      }),
    )

    // Map common desk-auth failures to concise operator copy.
    const lower = message.toLowerCase()
    if (lower.includes('revoked')) {
      return {
        success: false,
        attendee: null,
        alreadyCheckedIn: false,
        message: 'This desk credential has been revoked.',
      }
    }
    if (lower.includes('expired')) {
      return {
        success: false,
        attendee: null,
        alreadyCheckedIn: false,
        message: 'This desk credential has expired.',
      }
    }
    if (lower.includes('not found')) {
      return {
        success: false,
        attendee: null,
        alreadyCheckedIn: false,
        message: 'Attendee not found.',
      }
    }

    return {
      success: false,
      attendee: null,
      alreadyCheckedIn: false,
      message: CHECK_IN_FAILURE_MESSAGE,
    }
  }
}

export function mergeAttendeesWithPersistedCheckIns(
  attendees: Attendee[],
  eventId?: string | null,
): Attendee[] {
  return applyPersistedCheckIns(attendees, eventId)
}
