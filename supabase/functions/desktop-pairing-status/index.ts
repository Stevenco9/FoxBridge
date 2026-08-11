import {
  assertConferenceScope,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface PairingStatusBody {
  deskToken?: string
  conferenceId?: string
  tokenId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json()) as PairingStatusBody
    const tokenId = body.tokenId?.trim()
    if (!tokenId) {
      return errorResponse('tokenId is required.')
    }

    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    const conferenceId = assertConferenceScope(desk, body.conferenceId)

    const { data, error } = await client
      .from('scanner_pairing_tokens')
      .select('used_at, conference_id')
      .eq('id', tokenId)
      .maybeSingle()

    if (error) {
      return errorResponse(error.message, 500)
    }

    if (!data || data.conference_id !== conferenceId) {
      return jsonResponse({ used: false, usedAt: null })
    }

    const usedAt = (data.used_at as string | null) ?? null
    return jsonResponse({
      used: Boolean(usedAt),
      usedAt,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to read pairing status.',
      500,
    )
  }
})
