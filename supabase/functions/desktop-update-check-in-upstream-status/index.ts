import { insertCheckInAuditBestEffort } from '../_shared/checkInAudit.ts'
import {
  assertPrincipalRole,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface UpstreamStatusResult {
  attendeeId?: string
  upstreamSyncStatus?: string
  upstreamLastErrorCode?: string | null
  upstreamRetryEligible?: boolean
  upstreamAttemptCount?: number
  upstreamNextAttemptAt?: string | null
  platformId?: string | null
}

interface WriteBody {
  deskToken?: string
  conferenceId?: string
  platformId?: string | null
  results?: UpstreamStatusResult[]
}

const ALLOWED_STATUS = new Set(['synced', 'failed', 'not_applicable', 'pending'])

/**
 * Sprint 23.5b1 — Principal-only batch writeback of upstream reconciliation results.
 * Does not modify checked_in / checked_in_at (operational authority unchanged).
 * Sprint 23.5b2 — best-effort upstream audit.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json().catch(() => ({}))) as WriteBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    assertPrincipalRole(
      desk,
      'Only the Principal Desktop can update upstream check-in status.',
    )
    const conferenceId = desk.conference_id
    const batchPlatformId = body.platformId?.trim() || null

    const results = Array.isArray(body.results) ? body.results : []
    if (results.length === 0) {
      return jsonResponse({ conferenceId, updated: 0 })
    }
    if (results.length > 100) {
      return errorResponse('Too many results in one batch.', 400)
    }

    const now = new Date().toISOString()
    let updated = 0

    for (const item of results) {
      const attendeeId = item.attendeeId?.trim()
      const status = item.upstreamSyncStatus?.trim()
      if (!attendeeId || !status || !ALLOWED_STATUS.has(status)) {
        continue
      }

      const retryEligible =
        status === 'synced' || status === 'not_applicable'
          ? false
          : item.upstreamRetryEligible !== false

      const patch: Record<string, unknown> = {
        upstream_sync_status: status,
        upstream_last_error_code:
          status === 'synced' ? null : item.upstreamLastErrorCode?.trim() || null,
        upstream_retry_eligible: retryEligible,
        updated_at: now,
      }

      if (typeof item.upstreamAttemptCount === 'number' && item.upstreamAttemptCount >= 0) {
        patch.upstream_attempt_count = Math.floor(item.upstreamAttemptCount)
      }

      if (status === 'synced') {
        patch.upstream_synced_at = now
        patch.upstream_next_attempt_at = null
        patch.upstream_retry_eligible = false
      } else if (status === 'not_applicable') {
        patch.upstream_synced_at = null
        patch.upstream_next_attempt_at = null
        patch.upstream_retry_eligible = false
      } else if (status === 'failed') {
        patch.upstream_next_attempt_at = retryEligible
          ? item.upstreamNextAttemptAt?.trim() || null
          : null
      } else if (status === 'pending') {
        patch.upstream_next_attempt_at = item.upstreamNextAttemptAt?.trim() || null
        patch.upstream_retry_eligible = true
      }

      const { data, error } = await client
        .from('conference_attendee_check_ins')
        .update(patch)
        .eq('conference_id', conferenceId)
        .eq('attendee_id', attendeeId)
        .select('attendee_id')
        .maybeSingle()

      if (error) {
        return errorResponse(error.message, 500)
      }
      if (data) {
        updated += 1

        const platformId = item.platformId?.trim() || batchPlatformId
        if (status === 'synced') {
          await insertCheckInAuditBestEffort(client, {
            conferenceId,
            attendeeId,
            action: 'upstream_check_in_synced',
            deskDeviceId: desk.id,
            platformId,
            details: {
              attemptCount: item.upstreamAttemptCount ?? null,
            },
          })
        } else if (status === 'failed') {
          await insertCheckInAuditBestEffort(client, {
            conferenceId,
            attendeeId,
            action: 'upstream_check_in_failed',
            deskDeviceId: desk.id,
            platformId,
            details: {
              errorCode: item.upstreamLastErrorCode?.trim() || null,
              retryEligible,
              attemptCount: item.upstreamAttemptCount ?? null,
            },
          })
        }
      }
    }

    console.info(
      '[desktop-update-check-in-upstream-status]',
      JSON.stringify({
        conferenceId,
        deskDeviceId: desk.id,
        updated,
        batchSize: results.length,
      }),
    )

    return jsonResponse({ conferenceId, updated })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error
        ? error.message
        : 'Unable to update upstream check-in status.',
      500,
    )
  }
})
