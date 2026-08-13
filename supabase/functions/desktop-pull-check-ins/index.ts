import {
  assertConferenceScope,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface PullBody {
  deskToken?: string
  conferenceId?: string
  /** Inclusive lower-bound cursor (ISO). Rows filtered client-side for id tie-break. */
  updatedAfter?: string | null
  /** Tie-break id when updated_at equals updatedAfter. */
  afterAttendeeId?: string | null
  limit?: number
}

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 1000

/**
 * Sprint 23.5a — desk-authenticated incremental pull of operational check-ins.
 * Conference from desk binding. No anon table access.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json().catch(() => ({}))) as PullBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    const conferenceId = assertConferenceScope(desk, body.conferenceId)

    const limit = Math.min(
      Math.max(Number(body.limit) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    )
    const updatedAfter = body.updatedAfter?.trim() || null
    const afterAttendeeId = body.afterAttendeeId?.trim() || null

    let query = client
      .from('conference_attendee_check_ins')
      .select(
        'attendee_id, registration_id, checked_in, checked_in_at, checked_in_by_desk_device_id, source, updated_at, upstream_sync_status',
      )
      .eq('conference_id', conferenceId)
      .order('updated_at', { ascending: true })
      .order('attendee_id', { ascending: true })
      .limit(limit)

    if (updatedAfter) {
      query = query.gte('updated_at', updatedAfter)
    }

    const { data, error } = await query
    if (error) {
      return errorResponse(error.message, 500)
    }

    const rows = (data ?? []).filter((row) => {
      if (!updatedAfter) {
        return true
      }
      const ts = String(row.updated_at)
      if (ts > updatedAfter) {
        return true
      }
      if (ts < updatedAfter) {
        return false
      }
      if (!afterAttendeeId) {
        return true
      }
      return String(row.attendee_id) > afterAttendeeId
    })

    console.info(
      '[desktop-pull-check-ins]',
      JSON.stringify({
        conferenceId,
        deskDeviceId: desk.id,
        pulled: rows.length,
        updatedAfter,
      }),
    )

    return jsonResponse({
      conferenceId,
      checkIns: rows.map((row) => ({
        attendeeId: row.attendee_id,
        registrationId: row.registration_id,
        checkedIn: row.checked_in === true,
        checkedInAt: row.checked_in_at,
        checkedInByDeskDeviceId: row.checked_in_by_desk_device_id,
        source: row.source,
        updatedAt: row.updated_at,
        upstreamSyncStatus: row.upstream_sync_status,
      })),
      count: rows.length,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to pull check-ins.',
      500,
    )
  }
})
