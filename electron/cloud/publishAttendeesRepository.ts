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
import { ensureConferenceId, resolveConferenceId } from './conferenceRepository'
import { loadSupabaseConnectionConfig } from './supabaseConfig'
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
  const connection = loadSupabaseConnectionConfig()
  const publishState = await getCloudPublishState()

  if (!connection) {
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
      conferenceId: null,
      conferenceName: null,
      lastPublishAt: publishState.lastPublishAt,
      lastPublishAttendeeCount: publishState.lastPublishAttendeeCount,
      lastPublishError: publishState.lastPublishError,
    }
  }

  const { error: pingError } = await client.from('conferences').select('id').limit(1)
  if (pingError) {
    console.error(
      '[cloud-status]',
      JSON.stringify({
        httpStatus: pingError.code === 'PGRST301' ? 401 : null,
        code: pingError.code ?? null,
        message: pingError.message,
      }),
    )
    return {
      configured: true,
      connected: false,
      conferenceId: null,
      conferenceName: null,
      lastPublishAt: publishState.lastPublishAt,
      lastPublishAttendeeCount: publishState.lastPublishAttendeeCount,
      lastPublishError: publishState.lastPublishError,
    }
  }

  let conferenceId: string | null = null
  let conferenceName: string | null = null

  try {
    const conference = await resolveConferenceId(false)
    if (conference) {
      conferenceId = conference.id
      conferenceName = conference.name
    }
  } catch (error) {
    console.error(
      '[cloud-status] conference lookup failed',
      error instanceof Error ? error.message : error,
    )
  }

  return {
    configured: true,
    connected: true,
    conferenceId,
    conferenceName,
    lastPublishAt: publishState.lastPublishAt,
    lastPublishAttendeeCount: publishState.lastPublishAttendeeCount,
    lastPublishError: publishState.lastPublishError,
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

async function replaceMealEntitlements(
  conferenceId: string,
  rows: PublishMealEntitlementRow[],
): Promise<void> {
  const client = getSupabaseServiceClient()
  if (!client) {
    throw new Error('Supabase is not configured.')
  }

  // Full conference replace so cancelled / removed / remapped attendees cannot leave
  // stale entitlement rows that diverge from the current RegFox sync.
  const { error: deleteError } = await client
    .from('meal_entitlements')
    .delete()
    .eq('conference_id', conferenceId)
  if (deleteError) {
    throw new Error(`meal_entitlements delete failed: ${deleteError.message}`)
  }

  if (rows.length === 0) {
    return
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
  const connection = loadSupabaseConnectionConfig()
  if (!connection) {
    const message =
      'Phone scanning is not configured. Add the service URL, public key, and desktop connection key under Settings → Advanced.'
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

  let conferenceId: string
  try {
    conferenceId = await ensureConferenceId()
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to prepare the conference record before publishing.'
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
    const payload = buildAttendeePublishPayload(attendee, conferenceId, publishedAt)
    attendeeRows.push(payload.attendee)
    entitlementRows.push(...payload.mealEntitlements)
  }

  try {
    await upsertAttendees(attendeeRows)

    await replaceMealEntitlements(conferenceId, entitlementRows)

    await client
      .from('conferences')
      .update({ last_desktop_sync_at: publishedAt, updated_at: publishedAt })
      .eq('id', conferenceId)
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
