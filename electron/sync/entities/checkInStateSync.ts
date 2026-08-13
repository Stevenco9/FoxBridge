import {
  persistEventAttendeeCheckIn,
} from '../../db/attendeeCheckInRepository'
import {
  getAttendeeCacheEventId,
  patchAttendeeCheckInInCache,
  reapplyOperationalCheckInsToCache,
} from '../../scannerServer/attendeeCache'
import { pullCheckInsViaDesk } from '../../cloud/desktopCloudApi'
import { readDeskCredentialSync } from '../../cloud/deskCredentialStore'
import { notifyAttendeesChanged } from '../../ui/notifyAttendeesChanged'
import { getSyncEntityCursor, setSyncEntityCursor } from '../syncCursorStore'
import type {
  SyncContext,
  SyncEntityHandler,
  SyncEntityResult,
} from '../syncTypes'

/**
 * Sprint 23.5a — Cloud → local operational check-in overlay pull.
 * Desk-auth Edge only (no anon RLS). Registration snapshot is separate.
 */
export const checkInStateSyncHandler: SyncEntityHandler = {
  entityType: 'check_in_state',

  async sync(context: SyncContext): Promise<SyncEntityResult> {
    const desk = readDeskCredentialSync()
    if (!desk) {
      return {
        entityType: 'check_in_state',
        status: 'skipped',
        pulled: 0,
        inserted: 0,
        skippedExisting: 0,
        error: 'No desk credential.',
      }
    }

    if (desk.conferenceId !== context.conferenceId) {
      return {
        entityType: 'check_in_state',
        status: 'failed',
        pulled: 0,
        inserted: 0,
        skippedExisting: 0,
        error: 'Sync conference does not match desk credential conference.',
      }
    }

    const eventId = context.foxbridgeEventId?.trim()
    if (!eventId) {
      return {
        entityType: 'check_in_state',
        status: 'skipped',
        pulled: 0,
        inserted: 0,
        skippedExisting: 0,
        error: 'No active FoxBridge Event.',
      }
    }

    try {
      const cursor = await getSyncEntityCursor(
        context.conferenceId,
        'check_in_state',
        eventId,
      )

      let pulled = 0
      let inserted = 0
      let skippedExisting = 0
      let workingCursor = { ...cursor }
      let changed = false

      for (;;) {
        const page = await pullCheckInsViaDesk({
          updatedAfter: workingCursor.lastTimestamp,
          afterAttendeeId: workingCursor.lastId,
          limit: 500,
        })

        if (page.conferenceId !== context.conferenceId) {
          return {
            entityType: 'check_in_state',
            status: 'failed',
            pulled,
            inserted,
            skippedExisting,
            error: 'Pulled check-ins conference mismatch.',
          }
        }

        if (page.checkIns.length === 0) {
          break
        }

        for (const row of page.checkIns) {
          pulled += 1
          if (!row.checkedIn || !row.checkedInAt) {
            skippedExisting += 1
            continue
          }

          persistEventAttendeeCheckIn({
            eventId,
            attendeeId: row.attendeeId,
            registrationId: row.registrationId,
            checkedIn: true,
            checkedInAt: row.checkedInAt,
            source: row.source || 'sync',
            updatedAt: row.updatedAt || row.checkedInAt,
          })
          inserted += 1
          changed = true

          if (getAttendeeCacheEventId() === eventId) {
            patchAttendeeCheckInInCache({
              attendeeId: row.attendeeId,
              eventId,
              checkedIn: true,
              checkedInAt: row.checkedInAt,
            })
          }
        }

        const last = page.checkIns[page.checkIns.length - 1]
        workingCursor = {
          lastTimestamp: last.updatedAt,
          lastId: last.attendeeId,
        }

        if (page.checkIns.length < 500) {
          break
        }
      }

      await setSyncEntityCursor(
        context.conferenceId,
        'check_in_state',
        workingCursor,
        eventId,
      )

      if (changed) {
        reapplyOperationalCheckInsToCache(eventId)
        notifyAttendeesChanged()
      }

      console.info(
        '[check-in-sync]',
        JSON.stringify({
          conferenceId: context.conferenceId,
          eventId,
          pulled,
          inserted,
          cursor: workingCursor.lastTimestamp,
        }),
      )

      return {
        entityType: 'check_in_state',
        status: 'synced',
        pulled,
        inserted,
        skippedExisting,
      }
    } catch (error) {
      return {
        entityType: 'check_in_state',
        status: 'failed',
        pulled: 0,
        inserted: 0,
        skippedExisting: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
