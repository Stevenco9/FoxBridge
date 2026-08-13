import {
  assertPrincipalRole,
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
  limit?: number
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

/**
 * Sprint 23.5b1 — Principal-only pull of upstream-reconciliation-eligible check-ins.
 * Excludes terminal / exhausted rows (upstream_retry_eligible = false).
 * Honors upstream_next_attempt_at for durable backoff across Principal restart.
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
    assertPrincipalRole(
      desk,
      'Only the Principal Desktop can reconcile upstream check-ins.',
    )
    const conferenceId = desk.conference_id

    const limit = Math.min(
      Math.max(Number(body.limit) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    )

    const { data, error } = await client
      .from('conference_attendee_check_ins')
      .select(
        'attendee_id, registration_id, checked_in_at, upstream_sync_status, upstream_last_error_code, upstream_attempt_count, upstream_next_attempt_at, upstream_retry_eligible, updated_at',
      )
      .eq('conference_id', conferenceId)
      .eq('checked_in', true)
      .eq('upstream_retry_eligible', true)
      .in('upstream_sync_status', ['pending', 'failed'])
      .order('updated_at', { ascending: true })
      .limit(Math.min(limit * 3, MAX_LIMIT * 2))

    if (error) {
      return errorResponse(error.message, 500)
    }

    const nowMs = Date.now()
    const rows = (data ?? [])
      .filter((row) => {
        const next = row.upstream_next_attempt_at
        if (next == null || String(next).trim() === '') {
          return true
        }
        const nextMs = new Date(String(next)).getTime()
        return !Number.isNaN(nextMs) && nextMs <= nowMs
      })
      .slice(0, limit)

    console.info(
      '[desktop-pull-pending-check-ins]',
      JSON.stringify({
        conferenceId,
        deskDeviceId: desk.id,
        pulled: rows.length,
      }),
    )

    return jsonResponse({
      conferenceId,
      checkIns: rows.map((row) => ({
        attendeeId: row.attendee_id,
        registrationId: row.registration_id,
        checkedInAt: row.checked_in_at,
        upstreamSyncStatus: row.upstream_sync_status,
        upstreamLastErrorCode: row.upstream_last_error_code,
        upstreamAttemptCount: row.upstream_attempt_count ?? 0,
        upstreamNextAttemptAt: row.upstream_next_attempt_at,
        upstreamRetryEligible: row.upstream_retry_eligible !== false,
        updatedAt: row.updated_at,
      })),
      count: rows.length,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to pull pending check-ins.',
      500,
    )
  }
})
