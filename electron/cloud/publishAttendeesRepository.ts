import type { Attendee } from '../../src/shared/models'
import type { CloudStatus, PublishAttendeesResult } from '../../src/shared/models/CloudStatus'
import { getAttendeeCache, isAttendeeCacheLoaded } from '../scannerServer/attendeeCache'
import {
  buildAttendeePublishPayload,
  type PublishAttendeeRow,
  type PublishMealEntitlementRow,
} from './buildPublishPayload'
import {
  getCloudPublishState,
  setCloudPublishError,
  setCloudPublishSuccess,
} from './cloudPublishStore'
import { loadSupabaseConfig } from './supabaseConfig'
import { getSupabaseServiceClient } from './supabaseClient'

const UPSERT_BATCH_SIZE = 100

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

export async function getCloudStatus(): Promise<CloudStatus> {
  const config = loadSupabaseConfig()
  const publishState = await getCloudPublishState()

  if (!config) {
    return {
      configured: false,
      connected: false,
      conferenceId: null,
      conferenceName: null,
      lastPublishAt: publishState.lastPublishAt,
      lastPublishAttendeeCount: publishState.lastPublishAttendeeCount,
      lastPublishError: publishState.lastPublishError,
    }
  }

  const client = getSupabaseServiceClient()
  if (!client) {
    return {
      configured: true,
      connected: false,
      conferenceId: config.conferenceId,
      conferenceName: null,
      lastPublishAt: publishState.lastPublishAt,
      lastPublishAttendeeCount: publishState.lastPublishAttendeeCount,
      lastPublishError: publishState.lastPublishError,
    }
  }

  try {
    const { data, error } = await client
      .from('conferences')
      .select('id, name')
      .eq('id', config.conferenceId)
      .maybeSingle()

    if (error) {
      return {
        configured: true,
        connected: false,
        conferenceId: config.conferenceId,
        conferenceName: null,
        lastPublishAt: publishState.lastPublishAt,
        lastPublishAttendeeCount: publishState.lastPublishAttendeeCount,
        lastPublishError: publishState.lastPublishError,
      }
    }

    return {
      configured: true,
      connected: true,
      conferenceId: config.conferenceId,
      conferenceName: data?.name ?? null,
      lastPublishAt: publishState.lastPublishAt,
      lastPublishAttendeeCount: publishState.lastPublishAttendeeCount,
      lastPublishError: publishState.lastPublishError,
    }
  } catch {
    return {
      configured: true,
      connected: false,
      conferenceId: config.conferenceId,
      conferenceName: null,
      lastPublishAt: publishState.lastPublishAt,
      lastPublishAttendeeCount: publishState.lastPublishAttendeeCount,
      lastPublishError: publishState.lastPublishError,
    }
  }
}

async function upsertAttendees(rows: PublishAttendeeRow[]): Promise<void> {
  const client = getSupabaseServiceClient()
  if (!client) {
    throw new Error('Supabase is not configured.')
  }

  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await client
      .from('attendees')
      .upsert(batch, { onConflict: 'conference_id,attendee_id' })
    if (error) {
      throw new Error(`attendees upsert failed: ${error.message}`)
    }
  }
}

async function upsertMealEntitlements(rows: PublishMealEntitlementRow[]): Promise<void> {
  const client = getSupabaseServiceClient()
  if (!client) {
    throw new Error('Supabase is not configured.')
  }

  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await client
      .from('meal_entitlements')
      .upsert(batch, { onConflict: 'conference_id,attendee_id,meal_key' })
    if (error) {
      throw new Error(`meal_entitlements upsert failed: ${error.message}`)
    }
  }
}

export async function publishAttendees(attendees?: Attendee[]): Promise<PublishAttendeesResult> {
  const config = loadSupabaseConfig()
  if (!config) {
    const message =
      'Supabase is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, and SUPABASE_CONFERENCE_ID in .env.'
    await setCloudPublishError(message)
    return {
      success: false,
      attendeeCount: 0,
      publishedAt: null,
      error: message,
    }
  }

  const sourceAttendees = attendees ?? getAttendeeCache()
  if (sourceAttendees.length === 0 || !isAttendeeCacheLoaded()) {
    const message = 'No attendees loaded. Wait for RegFox sync before publishing.'
    await setCloudPublishError(message)
    return {
      success: false,
      attendeeCount: 0,
      publishedAt: null,
      error: message,
    }
  }

  const client = getSupabaseServiceClient()
  if (!client) {
    const message = 'Unable to create Supabase client.'
    await setCloudPublishError(message)
    return {
      success: false,
      attendeeCount: 0,
      publishedAt: null,
      error: message,
    }
  }

  const publishedAt = new Date().toISOString()
  const attendeeRows: PublishAttendeeRow[] = []
  const entitlementRows: PublishMealEntitlementRow[] = []

  for (const attendee of sourceAttendees) {
    const payload = buildAttendeePublishPayload(attendee, config.conferenceId, publishedAt)
    attendeeRows.push(payload.attendee)
    entitlementRows.push(...payload.mealEntitlements)
  }

  try {
    await upsertAttendees(attendeeRows)

    if (entitlementRows.length > 0) {
      await upsertMealEntitlements(entitlementRows)
    }

    await client
      .from('conferences')
      .update({ last_desktop_sync_at: publishedAt, updated_at: publishedAt })
      .eq('id', config.conferenceId)
      .then(({ error }) => {
        if (error) {
          // Conference row may not exist yet; attendee publish still succeeded.
        }
      })

    await setCloudPublishSuccess(sourceAttendees.length, publishedAt)

    return {
      success: true,
      attendeeCount: sourceAttendees.length,
      publishedAt,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to publish attendees to Supabase.'
    await setCloudPublishError(message)
    return {
      success: false,
      attendeeCount: 0,
      publishedAt: null,
      error: message,
    }
  }
}
