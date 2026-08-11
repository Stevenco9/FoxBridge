import { getSupabaseServiceClient } from '../cloud/supabaseClient'
import { getSupabaseAnonClient } from '../cloud/desktopCloudApi'
import { readPublicSettings } from '../settings/settingsStore'
import { mealValidationSyncHandler } from './entities/mealValidationSync'
import type { SyncEntityHandler, SyncRunResult } from './syncTypes'

/**
 * Registered Desktop Sync entity handlers.
 *
 * Extension point: append a new SyncEntityHandler implementation for notes,
 * badge print history, device sessions, etc. Each handler owns Cloud fetch,
 * cursor key, and SQLite apply policy — do not add a generic conflict engine.
 */
const ENTITY_HANDLERS: readonly SyncEntityHandler[] = [mealValidationSyncHandler]

/**
 * Desktop Sync Service — Cloud → SQLite operational pull.
 *
 * Uses anon client when available (RLS-permitted reads). Falls back to legacy
 * service-role client for development/migration installs.
 */
export async function sync(): Promise<SyncRunResult> {
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
    for (const handler of ENTITY_HANDLERS) {
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
 * Fire-and-forget wrapper for lifecycle hooks. Never rejects.
 */
export async function syncBestEffort(): Promise<void> {
  try {
    const result = await sync()
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
