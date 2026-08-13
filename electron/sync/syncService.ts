import { getSupabaseServiceClient } from '../cloud/supabaseClient'
import { getSupabaseAnonClient } from '../cloud/desktopCloudApi'
import { readPublicSettings } from '../settings/settingsStore'
import { attendeeSnapshotSyncHandler } from './entities/attendeeSnapshotSync'
import { checkInStateSyncHandler } from './entities/checkInStateSync'
import { mealValidationSyncHandler } from './entities/mealValidationSync'
import type { SyncEntityHandler, SyncEntityType, SyncRunResult } from './syncTypes'

/**
 * Registered Desktop Sync entity handlers.
 *
 * Extension point: append a new SyncEntityHandler implementation for notes,
 * badge print history, device sessions, etc. Each handler owns Cloud fetch,
 * cursor key, and SQLite apply policy — do not add a generic conflict engine.
 *
 * attendee_snapshot runs first so meal_validations can map against the latest
 * Local Event Store / cache for the active conference.
 * check_in_state is independent of snapshot authority and runs for Principal + Linked.
 */
const ENTITY_HANDLERS: readonly SyncEntityHandler[] = [
  attendeeSnapshotSyncHandler,
  mealValidationSyncHandler,
  checkInStateSyncHandler,
]

const CHECK_IN_ONLY_HANDLERS: readonly SyncEntityHandler[] = [checkInStateSyncHandler]

async function runHandlers(
  handlers: readonly SyncEntityHandler[],
): Promise<SyncRunResult> {
  try {
    const client = getSupabaseAnonClient() ?? getSupabaseServiceClient()
    if (!client) {
      return {
        status: 'skipped',
        reason: 'Cloud is not configured.',
        entities: [],
      }
    }

    const { resolveConferenceId } = await import('../cloud/conferenceRepository')
    const conference = await resolveConferenceId(false)
    if (!conference) {
      return {
        status: 'skipped',
        reason: 'No cloud conference is available yet.',
        entities: [],
      }
    }

    const settings = await readPublicSettings()
    const foxbridgeEventId = settings.activeEventId

    const entities = []
    for (const handler of handlers) {
      const result = await handler.sync({
        conferenceId: conference.id,
        client,
        foxbridgeEventId,
      })
      entities.push(result)
    }

    const anyFailed = entities.some((entity) => entity.status === 'failed')
    const anySynced = entities.some((entity) => entity.status === 'synced')

    return {
      status: anyFailed && !anySynced ? 'failed' : anySynced ? 'synced' : 'skipped',
      reason: anyFailed
        ? entities.find((entity) => entity.error)?.error
        : undefined,
      entities,
    }
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
      entities: [],
    }
  }
}

/**
 * Desktop Sync Service — Cloud → SQLite operational pull.
 *
 * Uses anon client when available (RLS-permitted reads). Falls back to legacy
 * service-role client for development/migration installs.
 * check_in_state uses desk-auth Edge (not anon table reads).
 */
export async function sync(options?: {
  entityTypes?: SyncEntityType[]
}): Promise<SyncRunResult> {
  if (options?.entityTypes?.length) {
    const wanted = new Set(options.entityTypes)
    return runHandlers(ENTITY_HANDLERS.filter((h) => wanted.has(h.entityType)))
  }
  return runHandlers(ENTITY_HANDLERS)
}

/**
 * Fire-and-forget wrapper for lifecycle hooks. Never rejects.
 */
export async function syncBestEffort(options?: {
  entityTypes?: SyncEntityType[]
}): Promise<void> {
  try {
    const result = await sync(options)
    if (result.status === 'failed') {
      console.warn('[desktop-sync]', result.reason ?? 'Sync failed.')
      return
    }

    if (result.status === 'synced') {
      const summary = result.entities
        .map(
          (entity) =>
            `${entity.entityType}: +${entity.inserted}/${entity.pulled} (skip ${entity.skippedExisting})`,
        )
        .join('; ')
      console.info('[desktop-sync]', summary || 'ok')
    }
  } catch (error) {
    console.warn(
      '[desktop-sync]',
      error instanceof Error ? error.message : String(error),
    )
  }
}

/** Fast path for multi-desk check-in convergence (10–15s cadence). */
export async function syncCheckInStateBestEffort(): Promise<void> {
  await syncBestEffort({ entityTypes: ['check_in_state'] })
}

export { CHECK_IN_ONLY_HANDLERS }
