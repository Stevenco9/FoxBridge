import { getAttendeeQrValue } from '../../../src/features/badge/getAttendeeQrValue'
import { importSyncedMealValidation } from '../../db/mealValidationRepository'
import { getAttendeeCache, isAttendeeCacheLoaded } from '../../scannerServer/attendeeCache'
import { getSyncEntityCursor, setSyncEntityCursor } from '../syncCursorStore'
import {
  advanceSyncCursor,
  isRowAfterSyncCursor,
  resolveLocalAttendeeIdForSync,
} from '../syncHelpers'
import type {
  SyncContext,
  SyncEntityHandler,
  SyncEntityResult,
} from '../syncTypes'

const PAGE_SIZE = 200

interface CloudMealValidationRow {
  id: string
  attendee_id: string
  meal_key: string
  meal_label: string
  validated_at: string
  source: string | null
  scanner_session_id: string | null
}

function buildAttendeeMappings(): {
  id: string
  qrIdentifier: string
}[] {
  if (!isAttendeeCacheLoaded()) {
    return []
  }

  return getAttendeeCache().map((attendee) => ({
    id: attendee.id,
    qrIdentifier: getAttendeeQrValue(attendee),
  }))
}

/**
 * Cloud → SQLite pull for meal_validations.
 * Policy: first write wins (local UNIQUE). Incremental via validated_at + id cursor.
 */
export const mealValidationSyncHandler: SyncEntityHandler = {
  entityType: 'meal_validations',

  async sync(context: SyncContext): Promise<SyncEntityResult> {
    const cursor = await getSyncEntityCursor(
      context.conferenceId,
      'meal_validations',
      context.foxbridgeEventId,
    )
    const mappings = buildAttendeeMappings()

    let pulled = 0
    let inserted = 0
    let skippedExisting = 0
    let workingCursor = { ...cursor }

    try {
      for (;;) {
        let query = context.client
          .from('meal_validations')
          .select(
            'id, attendee_id, meal_key, meal_label, validated_at, source, scanner_session_id',
          )
          .eq('conference_id', context.conferenceId)
          .order('validated_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(PAGE_SIZE)

        if (workingCursor.lastTimestamp) {
          // Inclusive lower bound; filter with isRowAfterSyncCursor for id tie-break.
          query = query.gte('validated_at', workingCursor.lastTimestamp)
        }

        const { data, error } = await query
        if (error) {
          return {
            entityType: 'meal_validations',
            status: 'failed',
            pulled,
            inserted,
            skippedExisting,
            error: error.message,
          }
        }

        const rows = (data ?? []) as CloudMealValidationRow[]
        if (rows.length === 0) {
          break
        }

        const batch = rows.filter((row) =>
          isRowAfterSyncCursor(
            { id: row.id, validatedAt: row.validated_at },
            workingCursor,
          ),
        )

        if (batch.length === 0) {
          // Only equal-timestamp already-cursor rows; advance past page by id if needed.
          workingCursor = advanceSyncCursor(
            workingCursor,
            rows.map((row) => ({ id: row.id, validatedAt: row.validated_at })),
          )
          if (rows.length < PAGE_SIZE) {
            break
          }
          continue
        }

        for (const row of batch) {
          pulled += 1
          const localAttendeeId = resolveLocalAttendeeIdForSync(
            row.attendee_id,
            mappings,
          )
          const result = importSyncedMealValidation({
            id: row.id,
            attendeeId: localAttendeeId,
            mealKey: row.meal_key,
            mealLabel: row.meal_label,
            validatedAt: row.validated_at,
            validatedBy: row.scanner_session_id,
            source: row.source ?? 'sync',
          })

          if (result === 'inserted') {
            inserted += 1
          } else {
            skippedExisting += 1
          }
        }

        workingCursor = advanceSyncCursor(
          workingCursor,
          batch.map((row) => ({ id: row.id, validatedAt: row.validated_at })),
        )

        if (rows.length < PAGE_SIZE) {
          break
        }
      }

      await setSyncEntityCursor(
        context.conferenceId,
        'meal_validations',
        workingCursor,
        context.foxbridgeEventId,
      )

      return {
        entityType: 'meal_validations',
        status: 'synced',
        pulled,
        inserted,
        skippedExisting,
      }
    } catch (error) {
      return {
        entityType: 'meal_validations',
        status: 'failed',
        pulled,
        inserted,
        skippedExisting,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
}
