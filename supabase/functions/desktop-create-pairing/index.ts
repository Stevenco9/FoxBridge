import {
  assertConferenceScope,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface CreatePairingBody {
  deskToken?: string
  conferenceId?: string
  tokenHash?: string
  expiresAt?: string
  role?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json()) as CreatePairingBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    const conferenceId = assertConferenceScope(desk, body.conferenceId)

    const tokenHash = body.tokenHash?.trim()
    const expiresAt = body.expiresAt?.trim()
    if (!tokenHash || !expiresAt) {
      return errorResponse('tokenHash and expiresAt are required.')
    }

    // Defensive: reject if caller accidentally sent a raw token.
    if (tokenHash.length !== 64 || !/^[a-f0-9]+$/i.test(tokenHash)) {
      return errorResponse('tokenHash must be a SHA-256 hex digest.')
    }

    const { data, error } = await client
      .from('scanner_pairing_tokens')
      .insert({
        conference_id: conferenceId,
        token_hash: tokenHash.toLowerCase(),
        role: body.role?.trim() || 'meal_scanner',
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (error || !data) {
      return errorResponse(error?.message ?? 'Unable to create pairing token.', 500)
    }

    return jsonResponse({
      tokenId: data.id,
      conferenceId,
      expiresAt,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to create pairing.',
      500,
    )
  }
})
