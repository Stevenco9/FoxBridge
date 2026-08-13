import {
  assertConferenceScope,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface ResolveBody {
  deskToken?: string
  conferenceId?: string
  regfoxEventId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json().catch(() => ({}))) as ResolveBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    const conferenceId = assertConferenceScope(desk, body.conferenceId)

    // Resolve is read-only for conference identity. Never overwrite
    // regfox_event_id from Desktop settings — Linked machines often retain a
    // prior Principal RegFox page id and would pollute another conference's
    // metadata (live: Test Event.regfox_event_id became AdAgrA's 1012457).

    const { data: conference, error } = await client
      .from('conferences')
      .select('id, name, regfox_event_id, external_event_id, last_desktop_sync_at')
      .eq('id', conferenceId)
      .maybeSingle()

    if (error) {
      return errorResponse(error.message, 500)
    }

    if (!conference) {
      return errorResponse('Conference not found for desk credential.', 404)
    }

    return jsonResponse({
      conferenceId: conference.id,
      conferenceName: conference.name,
      regfoxEventId: conference.regfox_event_id,
      externalEventId: conference.external_event_id ?? null,
      lastDesktopSyncAt: conference.last_desktop_sync_at,
      deskDeviceId: desk.id,
      deskRole: desk.role,
      deskExpiresAt: desk.expires_at,
      deskLabel: desk.label,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to resolve conference.',
      500,
    )
  }
})
