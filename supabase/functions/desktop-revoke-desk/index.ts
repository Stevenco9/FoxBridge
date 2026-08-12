import {
  assertPrincipalRole,
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  requireDeskDevice,
} from '../_shared/deskAuth.ts'

interface RevokeBody {
  deskToken?: string
  deskDeviceId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json()) as RevokeBody
    const targetId = body.deskDeviceId?.trim()
    if (!targetId) {
      return errorResponse('Choose a computer to disconnect.')
    }

    const client = createServiceClient()
    const desk = await requireDeskDevice(client, readDeskToken(req, body))
    assertPrincipalRole(desk)

    if (targetId === desk.id) {
      return errorResponse('Use Principal transfer to replace this Principal Desktop.', 400)
    }

    const { data, error } = await client.rpc('revoke_linked_desk_device', {
      p_conference_id: desk.conference_id,
      p_actor_desk_device_id: desk.id,
      p_target_desk_device_id: targetId,
    })

    if (error) {
      const message = error.message || 'Unable to disconnect that computer.'
      if (message.toLowerCase().includes('only the principal')) {
        return errorResponse('Only the Principal Desktop can disconnect Linked Desktops.', 403)
      }
      if (message.toLowerCase().includes('only linked')) {
        return errorResponse('Only Linked Desktops can be disconnected here.', 400)
      }
      if (message.toLowerCase().includes('not found')) {
        return errorResponse('That computer was not found for this event.', 404)
      }
      return errorResponse(message, 500)
    }

    const row = Array.isArray(data) ? data[0] : data
    return jsonResponse({
      deskDeviceId: row?.desk_device_id ?? targetId,
      revokedAt: row?.revoked_at ?? new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to disconnect that computer.',
      500,
    )
  }
})
