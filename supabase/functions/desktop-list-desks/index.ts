import {
  assertPrincipalRole,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface ListBody {
  deskToken?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json().catch(() => ({}))) as ListBody
    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    assertPrincipalRole(desk)

    const { data, error } = await client
      .from('desk_devices')
      .select('id, label, role, created_at, expires_at, revoked_at, last_used_at')
      .eq('conference_id', desk.conference_id)
      .order('created_at', { ascending: true })

    if (error) {
      return errorResponse(error.message, 500)
    }

    const desks = (data ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      role: row.role,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      lastUsedAt: row.last_used_at,
      isCurrent: row.id === desk.id,
    }))

    return jsonResponse({
      conferenceId: desk.conference_id,
      desks,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to list connected computers.',
      500,
    )
  }
})
