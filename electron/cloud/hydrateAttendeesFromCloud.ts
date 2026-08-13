import {
  buildAttendeeHydrateDiagnostics,
} from '../../src/shared/attendees/cloudAttendeeSnapshotSync'
import { mapCloudPublishedAttendeesToFoxBridge } from '../../src/shared/attendees/mapCloudPublishedAttendees'
import { mayReplaceLocalAttendeesFromCloudSnapshot } from './attendeeSnapshotAuthority'
import { pullAttendeesViaDesk } from '../cloud/desktopCloudApi'
import { getEventAttendees } from '../db/eventAttendeeRepository'
import {
  getAttendeeCacheEventId,
  replaceAttendeeCacheFromRegistrationSync,
} from '../scannerServer/attendeeCache'
import { getEventAccessSession } from '../session/eventAccessSession'
import { readDeskCredentialSync } from '../cloud/deskCredentialStore'
import { patchPublicSettings } from '../settings/settingsStore'
import { setSyncEntityCursor } from '../sync/syncCursorStore'

export interface HydrateSessionAttendeesResult {
  success: boolean
  attendeeCount: number
  message: string | null
  lastDesktopSyncAt?: string | null
  /** True when Cloud replace was refused (Principal / RegFox-authoritative). */
  skippedByRoleGate?: boolean
}

/**
 * Pull Principal-published attendees for the authenticated desk conference,
 * store under the current EventAccessSession FoxBridge Event id, and hydrate cache.
 *
 * Linked (and Cloud-only legacy) only. Principal / RegFox-authoritative desks
 * must NEVER replace rich local registration records with the lossy Cloud projection.
 */
export async function hydrateAttendeesFromCloudForSession(): Promise<HydrateSessionAttendeesResult> {
  const session = getEventAccessSession()
  if (!session?.eventId?.trim()) {
    return {
      success: false,
      attendeeCount: 0,
      message: 'Event access is locked.',
    }
  }

  const desk = readDeskCredentialSync()
  if (!desk) {
    return {
      success: false,
      attendeeCount: 0,
      message: 'This computer is not connected to FoxBridge Cloud yet.',
    }
  }

  if (!(await mayReplaceLocalAttendeesFromCloudSnapshot())) {
    console.info(
      '[attendee-hydrate]',
      JSON.stringify(
        buildAttendeeHydrateDiagnostics({
          sessionEventId: session.eventId,
          deskConferenceId: desk.conferenceId,
          pullConferenceId: null,
          cacheEventId: getAttendeeCacheEventId(),
          pullAttendeeCount: 0,
          pullEntitlementCount: 0,
          mappedAttendeeCount: 0,
          localStoredAttendeeCount: getEventAttendees(session.eventId).length,
          success: false,
          message: 'skipped_role_gate',
        }),
      ),
    )
    return {
      success: false,
      attendeeCount: 0,
      message:
        'Cloud attendee snapshot replace is not allowed for this Desktop role. Use Refresh registrations from RegFox when this computer is Principal.',
      skippedByRoleGate: true,
    }
  }

  if (session.conferenceId && session.conferenceId !== desk.conferenceId) {
    return {
      success: false,
      attendeeCount: 0,
      message: 'Desk credential does not match the active FoxBridge Event.',
    }
  }

  try {
    const pulled = await pullAttendeesViaDesk()
    if (pulled.conferenceId !== desk.conferenceId) {
      const message = 'Cloud returned attendees for a different event.'
      console.warn(
        '[attendee-hydrate]',
        JSON.stringify(
          buildAttendeeHydrateDiagnostics({
            sessionEventId: session.eventId,
            deskConferenceId: desk.conferenceId,
            pullConferenceId: pulled.conferenceId,
            cacheEventId: getAttendeeCacheEventId(),
            pullAttendeeCount: pulled.attendees.length,
            pullEntitlementCount: pulled.mealEntitlements.length,
            mappedAttendeeCount: 0,
            lastDesktopSyncAt: pulled.lastDesktopSyncAt,
            success: false,
            message,
          }),
        ),
      )
      return {
        success: false,
        attendeeCount: 0,
        message,
      }
    }

    const syncedAt = new Date().toISOString()
    const attendees = mapCloudPublishedAttendeesToFoxBridge({
      foxbridgeEventId: session.eventId,
      attendees: pulled.attendees,
      entitlements: pulled.mealEntitlements,
      syncedAt,
    })

    replaceAttendeeCacheFromRegistrationSync({
      attendees,
      eventId: session.eventId,
      sourcePlatform: 'foxbridge-cloud',
      syncedAt,
    })

    const cursorTs = pulled.lastDesktopSyncAt?.trim() || syncedAt
    await setSyncEntityCursor(
      desk.conferenceId,
      'attendee_snapshot',
      { lastTimestamp: cursorTs, lastId: null },
      session.eventId,
    )

    await patchPublicSettings({
      lastAttendeeSyncAt: syncedAt,
      // Linked refresh / hydrate is Cloud→local — never a phone publish failure.
      lastMobilePublishWarning: null,
    })

    console.info(
      '[attendee-hydrate]',
      JSON.stringify(
        buildAttendeeHydrateDiagnostics({
          sessionEventId: session.eventId,
          deskConferenceId: desk.conferenceId,
          pullConferenceId: pulled.conferenceId,
          cacheEventId: getAttendeeCacheEventId(),
          pullAttendeeCount: pulled.attendees.length,
          pullEntitlementCount: pulled.mealEntitlements.length,
          mappedAttendeeCount: attendees.length,
          localStoredAttendeeCount: getEventAttendees(session.eventId).length,
          lastDesktopSyncAt: pulled.lastDesktopSyncAt,
          success: true,
          message: null,
        }),
      ),
    )

    return {
      success: true,
      attendeeCount: attendees.length,
      message: null,
      lastDesktopSyncAt: pulled.lastDesktopSyncAt,
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to download attendees for this FoxBridge Event.'
    console.warn(
      '[attendee-hydrate]',
      JSON.stringify(
        buildAttendeeHydrateDiagnostics({
          sessionEventId: session.eventId,
          deskConferenceId: desk.conferenceId,
          pullConferenceId: null,
          cacheEventId: getAttendeeCacheEventId(),
          pullAttendeeCount: 0,
          pullEntitlementCount: 0,
          mappedAttendeeCount: 0,
          localStoredAttendeeCount: getEventAttendees(session.eventId).length,
          success: false,
          message,
        }),
      ),
    )
    return {
      success: false,
      attendeeCount: 0,
      message,
    }
  }
}
