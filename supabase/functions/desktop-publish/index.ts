import {
  assertConferenceScope,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface AttendeeRow {
  conference_id: string
  attendee_id: string
  [key: string]: unknown
}

interface EntitlementRow {
  conference_id: string
  attendee_id: string
  meal_key: string
  [key: string]: unknown
}

interface PublishBody {
  deskToken?: string
  conferenceId?: string
  attendees?: AttendeeRow[]
  mealEntitlements?: EntitlementRow[]
  publishedAt?: string
}

const BATCH = 100

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }
  return batches
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json()) as PublishBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    const conferenceId = assertConferenceScope(desk, body.conferenceId)

    const attendees = Array.isArray(body.attendees) ? body.attendees : []
    const entitlements = Array.isArray(body.mealEntitlements) ? body.mealEntitlements : []
    const publishedAt = body.publishedAt?.trim() || new Date().toISOString()

    for (const row of attendees) {
      if (row.conference_id !== conferenceId) {
        return errorResponse('Attendee payload conference mismatch.', 403)
      }
    }
    for (const row of entitlements) {
      if (row.conference_id !== conferenceId) {
        return errorResponse('Entitlement payload conference mismatch.', 403)
      }
    }

    for (const batch of chunk(attendees, BATCH)) {
      const { error } = await client
        .from('attendees')
        .upsert(batch, { onConflict: 'conference_id,attendee_id' })
      if (error) {
        return errorResponse(`attendees upsert failed: ${error.message}`, 500)
      }
    }

    const { error: deleteError } = await client
      .from('meal_entitlements')
      .delete()
      .eq('conference_id', conferenceId)
    if (deleteError) {
      return errorResponse(`meal_entitlements delete failed: ${deleteError.message}`, 500)
    }

    for (const batch of chunk(entitlements, BATCH)) {
      if (batch.length === 0) continue
      const { error } = await client
        .from('meal_entitlements')
        .upsert(batch, { onConflict: 'conference_id,attendee_id,meal_key' })
      if (error) {
        return errorResponse(`meal_entitlements upsert failed: ${error.message}`, 500)
      }
    }

    await client
      .from('conferences')
      .update({ last_desktop_sync_at: publishedAt, updated_at: publishedAt })
      .eq('id', conferenceId)

    return jsonResponse({
      success: true,
      conferenceId,
      attendeeCount: attendees.length,
      entitlementCount: entitlements.length,
      publishedAt,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to publish attendees.',
      500,
    )
  }
})
