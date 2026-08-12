import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  sha256Hex,
} from '../_shared/deskAuth.ts'
import { canonicalizeJoinCode, isFoxBridgeInstallationId } from '../_shared/joinCode.ts'

interface RedeemBody {
  joinCode?: string
  label?: string
  /** Opaque Desktop installation UUID — identity only, not authentication. */
  installationId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  try {
    const body = (await req.json()) as RedeemBody
    const joinCode = canonicalizeJoinCode(body.joinCode ?? '')
    if (!joinCode) {
      return errorResponse(
        'That connection code did not work. Check the code and try again.',
        401,
      )
    }

    let installationId: string | null = null
    const rawInstallation = body.installationId?.trim() || ''
    if (rawInstallation) {
      if (!isFoxBridgeInstallationId(rawInstallation)) {
        return errorResponse('Invalid installation identity.', 400)
      }
      installationId = rawInstallation.toLowerCase()
    }

    const client = createServiceClient()
    // Hash the canonical dashed form — matches issue_desk_join_code.
    const codeHash = await sha256Hex(joinCode)

    const deskTokenBytes = new Uint8Array(32)
    crypto.getRandomValues(deskTokenBytes)
    const deskToken = [...deskTokenBytes]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    const tokenHash = await sha256Hex(deskToken)

    const { data, error } = await client.rpc('redeem_desk_join_code', {
      p_code_hash: codeHash,
      p_token_hash: tokenHash,
      p_label: body.label?.trim() || null,
      p_installation_id: installationId,
    })

    if (error) {
      const message = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint]
        .filter(Boolean)
        .join(' ')
      if (message.includes('JOIN_CODE_INVALID')) {
        return errorResponse('That connection code did not work. Check the code and try again.', 401)
      }
      if (message.includes('JOIN_CODE_USED')) {
        return errorResponse('That connection code has already been used.', 409)
      }
      if (message.includes('JOIN_CODE_EXPIRED')) {
        return errorResponse('That connection code has expired. Ask for a new one.', 410)
      }
      if (
        message.toLowerCase().includes('ambiguous') ||
        message.includes('42702')
      ) {
        return errorResponse(
          'Unable to connect with that code. FoxBridge Cloud needs a Linked redeem update (migration 015).',
          500,
        )
      }
      if (
        message.toLowerCase().includes('desk_device_audit_action_check') ||
        message.toLowerCase().includes('linked_desktop_rejoined')
      ) {
        return errorResponse(
          'Unable to connect with that code. FoxBridge Cloud needs a Linked desk audit update (migration 014).',
          500,
        )
      }
      return errorResponse(message || 'Unable to connect with that code.', 500)
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row?.desk_device_id || !row?.conference_id || !row?.expires_at) {
      return errorResponse('Unable to connect with that code.', 500)
    }

    const { data: conference } = await client
      .from('conferences')
      .select('id, name, regfox_event_id')
      .eq('id', row.conference_id)
      .maybeSingle()

    return jsonResponse({
      deskToken,
      deskDeviceId: row.desk_device_id,
      conferenceId: row.conference_id,
      conferenceName: conference?.name ?? null,
      regfoxEventId: conference?.regfox_event_id ?? null,
      role: 'linked',
      expiresAt: row.expires_at,
      rejoined: Boolean(row.rejoined),
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to connect with that code.',
      500,
    )
  }
})
