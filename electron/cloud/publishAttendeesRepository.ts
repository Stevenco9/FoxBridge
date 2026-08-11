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
import { resolveDesktopCloudOpsTransport } from './cloudOpsTransport'
import { publishAttendeesViaDesk, resolveConferenceViaDesk } from './desktopCloudApi'
import { readDeskCredentialSync } from './deskCredentialStore'
import { getSupabaseServiceClient } from './supabaseClient'

const UPSERT_BATCH_SIZE = 100

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

function deskCredentialConfigured(): boolean {
  return Boolean(readDeskCredentialSync()?.deskToken)
}

function withPublishFields(
  publishState: Awaited<ReturnType<typeof getCloudPublishState>>,
  fields: Omit<
    CloudStatus,
    'lastPublishAt' | 'lastPublishAttendeeCount' | 'lastPublishError' | 'deskCredentialConfigured'
  > & { deskCredentialConfigured?: boolean },
): CloudStatus {
  return {
    lastPublishAt: publishState.lastPublishAt,
    lastPublishAttendeeCount: publishState.lastPublishAttendeeCount,
    lastPublishError: publishState.lastPublishError,
    deskCredentialConfigured: fields.deskCredentialConfigured ?? deskCredentialConfigured(),
    configured: fields.configured,
    connected: fields.connected,
    conferenceId: fields.conferenceId,
    conferenceName: fields.conferenceName,
    connectionError: fields.connectionError,
  }
}

export async function getCloudStatus(): Promise<CloudStatus> {
  const transport = resolveDesktopCloudOpsTransport()
  const publishState = await getCloudPublishState()

  if (transport === 'none') {
    return withPublishFields(publishState, {
      configured: false,
      connected: false,
      conferenceId: null,
      conferenceName: null,
      connectionError: null,
    })
  }

  if (transport === 'desk_credential') {
    try {
      const conference = await resolveConferenceViaDesk()
      return withPublishFields(publishState, {
        configured: true,
        connected: true,
        conferenceId: conference.id,
        conferenceName: conference.name,
        connectionError: null,
        deskCredentialConfigured: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify desk enrollment.'
      console.error('[cloud-status] desk conference resolve failed', message)
      const desk = readDeskCredentialSync()
      return withPublishFields(publishState, {
        configured: true,
        connected: false,
        conferenceId: desk?.conferenceId ?? null,
        conferenceName: null,
        connectionError: message,
        deskCredentialConfigured: true,
      })
    }
  }

  const client = getSupabaseServiceClient()
  if (!client) {
    return withPublishFields(publishState, {
      configured: true,
      connected: false,
      conferenceId: null,
      conferenceName: null,
      connectionError: null,
    })
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
    return withPublishFields(publishState, {
      configured: true,
      connected: false,
      conferenceId: null,
      conferenceName: null,
      connectionError: null,
    })
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

  return withPublishFields(publishState, {
    configured: true,
    connected: true,
    conferenceId,
    conferenceName,
    connectionError: null,
  })
}

async function upsertAttendees(rows: PublishAttendeeRow[]): Promise<void> {
  const client = getSupabaseServiceClient()
  if (!client) {
    throw new Error('Legacy Cloud client is not configured.')
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
    throw new Error('Legacy Cloud client is not configured.')
  }

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
  const transport = resolveDesktopCloudOpsTransport()
  if (transport === 'none') {
    const message =
      'FoxBridge Cloud is not ready. Enroll this computer with an enrollment code under Settings → Advanced, or configure development Cloud credentials.'
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
    if (transport === 'desk_credential') {
      await publishAttendeesViaDesk({
        conferenceId,
        attendees: attendeeRows,
        mealEntitlements: entitlementRows,
        publishedAt,
      })
    } else {
      const client = getSupabaseServiceClient()
      if (!client) {
        throw new Error('Unable to create legacy Cloud client.')
      }

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
    }

    await setCloudPublishSuccess(sourceAttendees.length, publishedAt)

    const { requestDesktopSyncBestEffort } = await import('../sync/syncManager')
    void requestDesktopSyncBestEffort()

    return {
      success: true,
      attendeeCount: sourceAttendees.length,
      publishedAt,
      error: null,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to publish attendees to FoxBridge Cloud.'
    await setCloudPublishError(message)
    return {
      success: false,
      attendeeCount: 0,
      publishedAt: null,
      error: message,
    }
  }
}
