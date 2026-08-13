import { insertCheckInAuditBestEffort } from '../_shared/checkInAudit.ts'
import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface CheckInBody {
  deskToken?: string
  /** Ignored as authority — conference always comes from the desk credential. */
  conferenceId?: string
  attendeeId?: string
}

/**
 * Sprint 23.5a — desk-authenticated operational check-in write.
 * Principal and Linked (and legacy) may call. No registration-platform API calls.
 * Conference is derived from desk binding only.
 * Sprint 23.5b2 — best-effort audit (never fails the check-in).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json().catch(() => ({}))) as CheckInBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    const conferenceId = desk.conference_id

    const attendeeId = body.attendeeId?.trim()
    if (!attendeeId) {
      return errorResponse('attendeeId is required.', 400)
    }

    const { data: attendee, error: attendeeError } = await client
      .from('attendees')
      .select('attendee_id, registration_id')
      .eq('conference_id', conferenceId)
      .eq('attendee_id', attendeeId)
      .maybeSingle()

    if (attendeeError) {
      return errorResponse(attendeeError.message, 500)
    }

    if (!attendee) {
      return errorResponse('Attendee not found in this event.', 404)
    }

    const { data: existing, error: existingError } = await client
      .from('conference_attendee_check_ins')
      .select(
        'conference_id, attendee_id, registration_id, checked_in, checked_in_at, checked_in_by_desk_device_id, source, created_at, updated_at, upstream_sync_status',
      )
      .eq('conference_id', conferenceId)
      .eq('attendee_id', attendeeId)
      .maybeSingle()

    if (existingError) {
      return errorResponse(existingError.message, 500)
    }

    if (existing?.checked_in) {
      console.info(
        '[desktop-check-in]',
        JSON.stringify({
          conferenceId,
          attendeeId,
          deskDeviceId: desk.id,
          alreadyCheckedIn: true,
          checkedInAt: existing.checked_in_at,
        }),
      )
      await insertCheckInAuditBestEffort(client, {
        conferenceId,
        attendeeId,
        action: 'attendee_check_in_duplicate',
        deskDeviceId: desk.id,
        details: { checkedInAt: existing.checked_in_at },
      })
      return jsonResponse({
        conferenceId,
        attendeeId: existing.attendee_id,
        registrationId: existing.registration_id,
        checkedIn: true,
        checkedInAt: existing.checked_in_at,
        alreadyCheckedIn: true,
        checkedInByDeskDeviceId: existing.checked_in_by_desk_device_id,
        source: existing.source,
        updatedAt: existing.updated_at,
        upstreamSyncStatus: existing.upstream_sync_status,
      })
    }

    const now = new Date().toISOString()
    const insertRow = {
      conference_id: conferenceId,
      attendee_id: attendeeId,
      registration_id: String(attendee.registration_id),
      checked_in: true,
      checked_in_at: now,
      checked_in_by_desk_device_id: desk.id,
      source: 'desktop',
      created_at: now,
      updated_at: now,
      upstream_sync_status: 'pending',
      upstream_synced_at: null,
      upstream_last_error_code: null,
    }

    const { data: inserted, error: insertError } = await client
      .from('conference_attendee_check_ins')
      .insert(insertRow)
      .select(
        'conference_id, attendee_id, registration_id, checked_in, checked_in_at, checked_in_by_desk_device_id, source, created_at, updated_at, upstream_sync_status',
      )
      .maybeSingle()

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: winner, error: winnerError } = await client
          .from('conference_attendee_check_ins')
          .select(
            'conference_id, attendee_id, registration_id, checked_in, checked_in_at, checked_in_by_desk_device_id, source, created_at, updated_at, upstream_sync_status',
          )
          .eq('conference_id', conferenceId)
          .eq('attendee_id', attendeeId)
          .maybeSingle()

        if (winnerError || !winner) {
          return errorResponse(
            winnerError?.message ?? 'Unable to resolve concurrent check-in.',
            500,
          )
        }

        console.info(
          '[desktop-check-in]',
          JSON.stringify({
            conferenceId,
            attendeeId,
            deskDeviceId: desk.id,
            alreadyCheckedIn: true,
            concurrentRace: true,
            checkedInAt: winner.checked_in_at,
          }),
        )

        await insertCheckInAuditBestEffort(client, {
          conferenceId,
          attendeeId,
          action: 'attendee_check_in_duplicate',
          deskDeviceId: desk.id,
          details: { concurrentRace: true, checkedInAt: winner.checked_in_at },
        })

        return jsonResponse({
          conferenceId,
          attendeeId: winner.attendee_id,
          registrationId: winner.registration_id,
          checkedIn: true,
          checkedInAt: winner.checked_in_at,
          alreadyCheckedIn: true,
          checkedInByDeskDeviceId: winner.checked_in_by_desk_device_id,
          source: winner.source,
          updatedAt: winner.updated_at,
          upstreamSyncStatus: winner.upstream_sync_status,
        })
      }

      return errorResponse(insertError.message, 500)
    }

    if (!inserted) {
      return errorResponse('Unable to write check-in.', 500)
    }

    console.info(
      '[desktop-check-in]',
      JSON.stringify({
        conferenceId,
        attendeeId,
        deskDeviceId: desk.id,
        alreadyCheckedIn: false,
        checkedInAt: inserted.checked_in_at,
        upstreamSyncStatus: inserted.upstream_sync_status,
      }),
    )

    await insertCheckInAuditBestEffort(client, {
      conferenceId,
      attendeeId,
      action: 'attendee_checked_in',
      deskDeviceId: desk.id,
      details: { checkedInAt: inserted.checked_in_at, source: inserted.source },
    })

    return jsonResponse({
      conferenceId,
      attendeeId: inserted.attendee_id,
      registrationId: inserted.registration_id,
      checkedIn: true,
      checkedInAt: inserted.checked_in_at,
      alreadyCheckedIn: false,
      checkedInByDeskDeviceId: inserted.checked_in_by_desk_device_id,
      source: inserted.source,
      updatedAt: inserted.updated_at,
      upstreamSyncStatus: inserted.upstream_sync_status,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to check in attendee.',
      500,
    )
  }
})
