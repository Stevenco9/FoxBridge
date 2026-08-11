import {
  assertConferenceScope,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface EnsureScannerBody {
  deskToken?: string
  conferenceId?: string
  code?: string
  label?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json().catch(() => ({}))) as EnsureScannerBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    const conferenceId = assertConferenceScope(desk, body.conferenceId)

    const { data: existing, error: listError } = await client
      .from('scanner_sessions')
      .select('code, label')
      .eq('conference_id', conferenceId)
      .order('created_at', { ascending: true })
      .limit(1)

    if (listError) {
      return errorResponse(listError.message, 500)
    }

    if (existing && existing.length > 0) {
      return jsonResponse({
        code: existing[0].code,
        label: existing[0].label,
        created: false,
      })
    }

    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 4)
    const code = body.code?.trim() || `meal-${suffix}`
    const label = body.label?.trim() || 'Meal scanner 1'

    const { error: insertError } = await client.from('scanner_sessions').insert({
      conference_id: conferenceId,
      code,
      label,
    })

    if (insertError) {
      return errorResponse(insertError.message, 500)
    }

    return jsonResponse({ code, label, created: true })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to ensure scanner session.',
      500,
    )
  }
})
