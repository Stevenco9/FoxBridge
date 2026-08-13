import {
  assertPrincipalRole,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface HealthBody {
  deskToken?: string
  conferenceId?: string
}

/**
 * Sprint 23.5b2 — Principal-only upstream check-in reconciliation health counts.
 * No attendee PII. Conference from desk binding only.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json().catch(() => ({}))) as HealthBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    assertPrincipalRole(
      desk,
      'Only the Principal Desktop can view upstream check-in health.',
    )
    const conferenceId = desk.conference_id

    const { data, error } = await client
      .from('conference_attendee_check_ins')
      .select(
        'upstream_sync_status, upstream_retry_eligible, upstream_last_error_code, checked_in_at, updated_at, created_at',
      )
      .eq('conference_id', conferenceId)
      .eq('checked_in', true)

    if (error) {
      return errorResponse(error.message, 500)
    }

    let pending = 0
    let failedRetryable = 0
    let terminalOrExhausted = 0
    let notApplicable = 0
    let synced = 0
    let oldestWaitingAt: string | null = null

    for (const row of data ?? []) {
      const status = String(row.upstream_sync_status ?? '')
      const eligible = row.upstream_retry_eligible !== false
      const stamp =
        (typeof row.created_at === 'string' && row.created_at) ||
        (typeof row.checked_in_at === 'string' && row.checked_in_at) ||
        (typeof row.updated_at === 'string' && row.updated_at) ||
        null

      if (status === 'synced') {
        synced += 1
        continue
      }
      if (status === 'not_applicable') {
        notApplicable += 1
        continue
      }
      if (status === 'pending' && eligible) {
        pending += 1
        if (stamp && (!oldestWaitingAt || stamp < oldestWaitingAt)) {
          oldestWaitingAt = stamp
        }
        continue
      }
      if (status === 'failed' && eligible) {
        failedRetryable += 1
        if (stamp && (!oldestWaitingAt || stamp < oldestWaitingAt)) {
          oldestWaitingAt = stamp
        }
        continue
      }
      if (status === 'failed' && !eligible) {
        terminalOrExhausted += 1
        continue
      }
      if (status === 'pending' && !eligible) {
        // Unexpected; treat as attention.
        terminalOrExhausted += 1
      }
    }

    console.info(
      '[desktop-upstream-check-in-health]',
      JSON.stringify({
        conferenceId,
        deskDeviceId: desk.id,
        pending,
        failedRetryable,
        terminalOrExhausted,
        synced,
      }),
    )

    return jsonResponse({
      conferenceId,
      pending,
      failedRetryable,
      terminalOrExhausted,
      notApplicable,
      synced,
      oldestWaitingAt,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to load upstream check-in health.',
      500,
    )
  }
})
