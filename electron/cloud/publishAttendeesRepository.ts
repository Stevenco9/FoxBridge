import type { Attendee } from '../../src/shared/models'
import type { CloudStatus, PublishAttendeesResult } from '../../src/shared/models/CloudStatus'
import { resolvePublishAttendeeSnapshot } from '../../src/shared/attendees/publishAttendeeIdentity'
import { getEventAttendees } from '../db/eventAttendeeRepository'
import {
  getAttendeeCache,
  getAttendeeCacheEventId,
  isAttendeeCacheLoaded,
} from '../scannerServer/attendeeCache'
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
import { getEventAccessSession } from '../session/eventAccessSession'
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

function localDeskRole(): CloudStatus['deskRole'] {
  return readDeskCredentialSync()?.role ?? null
}

function localDeskExpiresAt(): string | null {
  return readDeskCredentialSync()?.expiresAt ?? null
}

function withPublishFields(
  publishState: Awaited<ReturnType<typeof getCloudPublishState>>,
  fields: Omit<
    CloudStatus,
    | 'lastPublishAt'
    | 'lastPublishAttendeeCount'
    | 'lastPublishError'
    | 'deskCredentialConfigured'
    | 'deskRole'
    | 'deskExpiresAt'
  > & {
    deskCredentialConfigured?: boolean
    deskRole?: CloudStatus['deskRole']
    deskExpiresAt?: string | null
  },
): CloudStatus {
  return {
    lastPublishAt: publishState.lastPublishAt,
    lastPublishAttendeeCount: publishState.lastPublishAttendeeCount,
    lastPublishError: publishState.lastPublishError,
    deskCredentialConfigured: fields.deskCredentialConfigured ?? deskCredentialConfigured(),
    deskRole: fields.deskRole ?? localDeskRole(),
    deskExpiresAt: fields.deskExpiresAt ?? localDeskExpiresAt(),
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
        deskRole:
          conference.deskRole === 'principal' ||
          conference.deskRole === 'linked' ||
          conference.deskRole === 'legacy'
            ? conference.deskRole
            : localDeskRole(),
        deskExpiresAt: conference.deskExpiresAt ?? localDeskExpiresAt(),
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
        deskRole: desk?.role ?? null,
        deskExpiresAt: desk?.expiresAt ?? null,
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

async function replaceConferenceAttendees(
  conferenceId: string,
  rows: PublishAttendeeRow[],
): Promise<void> {
  const client = getSupabaseServiceClient()
  if (!client) {
    throw new Error('Legacy Cloud client is not configured.')
  }

  const { error: deleteError } = await client
    .from('attendees')
    .delete()
    .eq('conference_id', conferenceId)
  if (deleteError) {
    throw new Error(`attendees delete failed: ${deleteError.message}`)
  }

  if (rows.length === 0) {
    return
  }

  await upsertAttendees(rows)
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

/**
 * Publish Principal-authoritative attendees to FoxBridge Cloud.
 * Optional `attendees` override is only accepted when every row matches the
 * active EventAccessSession event identity (tests / explicit callers).
 */
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

  const session = getEventAccessSession()
  if (!session?.eventId?.trim()) {
    const message = 'Unlock the FoxBridge Event before publishing attendees.'
    await setCloudPublishError(message)
    return {
      success: false,
      attendeeCount: 0,
      publishedAt: null,
      error: message,
    }
  }

  const desk = readDeskCredentialSync()
  // Sprint 23.4a — Linked / non-Principal must never replace Cloud snapshot.
  // Edge also enforces assertPrincipalRole; this is fail-fast client defense.
  if (desk && desk.role !== 'principal') {
    const message =
      'Only the Principal Desktop can publish the event attendee snapshot to FoxBridge Cloud.'
    await setCloudPublishError(message)
    return {
      success: false,
      attendeeCount: 0,
      publishedAt: null,
      error: message,
    }
  }

  const storeAttendees = getEventAttendees(session.eventId)

  // Never publish the process-global cache. Optional override must still pass identity.
  const identity = resolvePublishAttendeeSnapshot({
    sessionEventId: session.eventId,
    sessionConferenceId: session.conferenceId,
    deskConferenceId: desk?.conferenceId ?? null,
    storeAttendees: attendees ?? storeAttendees,
  })

  if (!identity.ok) {
    if (
      isAttendeeCacheLoaded() &&
      getAttendeeCacheEventId() &&
      getAttendeeCacheEventId() !== session.eventId &&
      getAttendeeCache().length > 0
    ) {
      console.warn(
        '[cloud-publish] aborted cross-event cache',
        JSON.stringify({
          sessionEventId: session.eventId,
          cacheEventId: getAttendeeCacheEventId(),
          cacheCount: getAttendeeCache().length,
          reason: identity.reason,
        }),
      )
    }
    await setCloudPublishError(identity.reason)
    return {
      success: false,
      attendeeCount: 0,
      publishedAt: null,
      error: identity.reason,
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

  if (conferenceId !== identity.conferenceId) {
    const message =
      'Cloud conference from desk credential does not match the publish identity conference.'
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

  for (const attendee of identity.attendees) {
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

      await replaceConferenceAttendees(conferenceId, attendeeRows)
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

    await setCloudPublishSuccess(identity.attendees.length, publishedAt)

    const { requestDesktopSyncBestEffort } = await import('../sync/syncManager')
    void requestDesktopSyncBestEffort()

    return {
      success: true,
      attendeeCount: identity.attendees.length,
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
