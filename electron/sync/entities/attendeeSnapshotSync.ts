import { shouldPullCloudAttendeeSnapshot } from '../../../src/shared/attendees/cloudAttendeeSnapshotSync'
import { mayReplaceLocalAttendeesFromCloudSnapshot } from '../../cloud/attendeeSnapshotAuthority'
import { hydrateAttendeesFromCloudForSession } from '../../cloud/hydrateAttendeesFromCloud'
import { resolveConferenceViaDesk } from '../../cloud/desktopCloudApi'
import { readDeskCredentialSync } from '../../cloud/deskCredentialStore'
import { getSyncEntityCursor, setSyncEntityCursor } from '../syncCursorStore'
import type {
  SyncContext,
  SyncEntityHandler,
  SyncEntityResult,
} from '../syncTypes'

/**
 * Cloud → Local Event Store convergence for Principal-published attendee
 * + entitlement snapshots.
 *
 * Linked (and Cloud-only legacy) only. Principal / RegFox-authoritative desks
 * skip this entity so the lossy Cloud projection never replaces rich RegFox data.
 * meal_validations sync remains independent.
 */
export const attendeeSnapshotSyncHandler: SyncEntityHandler = {
  entityType: 'attendee_snapshot',

  async sync(context: SyncContext): Promise<SyncEntityResult> {
    const desk = readDeskCredentialSync()
    if (!desk) {
      return {
        entityType: 'attendee_snapshot',
        status: 'skipped',
        pulled: 0,
        inserted: 0,
        skippedExisting: 0,
        error: 'No desk credential.',
      }
    }

    if (!(await mayReplaceLocalAttendeesFromCloudSnapshot())) {
      return {
        entityType: 'attendee_snapshot',
        status: 'skipped',
        pulled: 0,
        inserted: 0,
        skippedExisting: 0,
        error: 'skipped_role_gate',
      }
    }

    if (desk.conferenceId !== context.conferenceId) {
      return {
        entityType: 'attendee_snapshot',
        status: 'failed',
        pulled: 0,
        inserted: 0,
        skippedExisting: 0,
        error: 'Sync conference does not match desk credential conference.',
      }
    }

    try {
      const resolved = await resolveConferenceViaDesk()
      if (resolved.id !== desk.conferenceId) {
        return {
          entityType: 'attendee_snapshot',
          status: 'failed',
          pulled: 0,
          inserted: 0,
          skippedExisting: 0,
          error: 'Resolved conference does not match desk credential.',
        }
      }

      const cursor = await getSyncEntityCursor(
        context.conferenceId,
        'attendee_snapshot',
        context.foxbridgeEventId,
      )

      const shouldPull = shouldPullCloudAttendeeSnapshot({
        localCursorTimestamp: cursor.lastTimestamp,
        cloudLastDesktopSyncAt: resolved.lastDesktopSyncAt,
      })

      if (!shouldPull) {
        return {
          entityType: 'attendee_snapshot',
          status: 'skipped',
          pulled: 0,
          inserted: 0,
          skippedExisting: 0,
        }
      }

      const hydrate = await hydrateAttendeesFromCloudForSession()
      if (hydrate.skippedByRoleGate) {
        return {
          entityType: 'attendee_snapshot',
          status: 'skipped',
          pulled: 0,
          inserted: 0,
          skippedExisting: 0,
          error: 'skipped_role_gate',
        }
      }
      if (!hydrate.success) {
        return {
          entityType: 'attendee_snapshot',
          status: 'failed',
          pulled: 0,
          inserted: 0,
          skippedExisting: 0,
          error: hydrate.message ?? 'Attendee snapshot pull failed.',
        }
      }

      const cursorTs =
        hydrate.lastDesktopSyncAt?.trim() ||
        resolved.lastDesktopSyncAt?.trim() ||
        new Date().toISOString()

      await setSyncEntityCursor(
        context.conferenceId,
        'attendee_snapshot',
        { lastTimestamp: cursorTs, lastId: null },
        context.foxbridgeEventId,
      )

      return {
        entityType: 'attendee_snapshot',
        status: 'synced',
        pulled: hydrate.attendeeCount,
        inserted: hydrate.attendeeCount,
        skippedExisting: 0,
      }
    } catch (error) {
      return {
        entityType: 'attendee_snapshot',
        status: 'failed',
        pulled: 0,
        inserted: 0,
        skippedExisting: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
