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

    const regfoxEventId = body.regfoxEventId?.trim()
    if (regfoxEventId) {
      await client
        .from('conferences')
        .update({
          regfox_event_id: regfoxEventId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conferenceId)
    }

    const { data: conference, error } = await client
      .from('conferences')
      .select('id, name, regfox_event_id, last_desktop_sync_at')
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
      lastDesktopSyncAt: conference.last_desktop_sync_at,
      deskDeviceId: desk.id,
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
