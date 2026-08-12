import {
  assertPrincipalRole,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface IssueBody {
  deskToken?: string
  label?: string
  ttlMinutes?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json()) as IssueBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    assertPrincipalRole(desk)

    const ttlMinutes =
      typeof body.ttlMinutes === 'number' && Number.isFinite(body.ttlMinutes)
        ? Math.trunc(body.ttlMinutes)
        : 15

    const { data, error } = await client.rpc('issue_desk_join_code', {
      p_conference_id: desk.conference_id,
      p_issued_by_desk_device_id: desk.id,
      p_ttl_minutes: ttlMinutes,
      p_label: body.label?.trim() || null,
    })

    if (error) {
      const message = error.message || 'Unable to create connection code.'
      if (message.toLowerCase().includes('only the principal')) {
        return errorResponse('Only the Principal Desktop can create connection codes.', 403)
      }
      return errorResponse(message, 500)
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row?.raw_code || !row?.expires_at) {
      return errorResponse('Unable to create connection code.', 500)
    }

    return jsonResponse({
      joinCode: row.raw_code,
      joinCodeId: row.join_code_id,
      conferenceId: row.conference_id ?? desk.conference_id,
      expiresAt: row.expires_at,
      ttlMinutes: Math.max(5, Math.min(ttlMinutes || 15, 30)),
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to create connection code.',
      500,
    )
  }
})
