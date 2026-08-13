import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  readDeskToken,
  sha256Hex,
} from '../_shared/deskAuth.ts'

const REGFFOX_FORMS_BASE = 'https://api.webconnex.com/v2/public'

interface ClaimBody {
  registrationPlatform?: string
  externalEventId?: string
  /** Transient RegFox API credential — never persisted or logged. */
  regfoxApiKey?: string
  label?: string
  /**
   * When an active Principal already exists, claim is rejected unless this is true.
   * Ordinary setup must not silently transfer ownership (Sprint 22.2).
   */
  confirmTransfer?: boolean
  /**
   * Optional existing Principal desk token for same-installation reactivation
   * (Sprint 23.2). Must match the active Principal for this conference.
   * Linked tokens are still rejected above. Never sufficient without RegFox proof.
   */
  reactivateDeskToken?: string
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/gi, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[redacted]')
    .replace(/apiKey["']?\s*[:=]\s*["']?[^"',\s]+/gi, 'apiKey=[redacted]')
    .slice(0, 300)
}

/**
 * Independently verify RegFox access to a specific form/event.
 * Uses the same proof path as Desktop: GET /forms/{eventId} with apiKey header.
 * Never logs the credential.
 */
async function verifyRegFoxEventAccess(
  apiKey: string,
  eventId: string,
): Promise<{ ok: true; displayName: string | null } | { ok: false; status: number; message: string }> {
  const url = `${REGFFOX_FORMS_BASE}/forms/${encodeURIComponent(eventId)}`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        apiKey,
        Accept: 'application/json',
      },
    })
  } catch {
    return {
      ok: false,
      status: 502,
      message: 'Unable to reach the registration platform to verify ownership.',
    }
  }

  if (response.ok) {
    let displayName: string | null = null
    try {
      const body = (await response.json()) as {
        data?: { name?: string; title?: string }
        name?: string
        title?: string
      }
      displayName =
        body.data?.name?.trim() ||
        body.data?.title?.trim() ||
        body.name?.trim() ||
        body.title?.trim() ||
        null
    } catch {
      displayName = null
    }
    return { ok: true, displayName }
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      status: 401,
      message: 'Registration credentials are invalid or do not allow access.',
    }
  }

  if (response.status === 404) {
    return {
      ok: false,
      status: 404,
      message: 'Registration event was not found for those credentials.',
    }
  }

  // Do not forward upstream body (may echo request context).
  return {
    ok: false,
    status: 502,
    message: 'Registration platform rejected the ownership check.',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  // Keep apiKey only in local bindings; never place on shared objects that get logged.
  let regfoxApiKey: string | null = null

  try {
    const body = (await req.json()) as ClaimBody
    const platform = body.registrationPlatform?.trim().toLowerCase()
    const externalEventId = body.externalEventId?.trim()
    regfoxApiKey = body.regfoxApiKey?.trim() || null
    const label = body.label?.trim() || null

    // Drop credential reference from body-shaped reuse.
    body.regfoxApiKey = undefined

    if (platform !== 'regfox') {
      return errorResponse('Unsupported registration platform.', 400)
    }
    if (!externalEventId) {
      return errorResponse('Registration event id is required.', 400)
    }
    if (!regfoxApiKey) {
      return errorResponse('Registration credentials are required.', 400)
    }

    /**
     * Linked / desk-token possession must never authorize Principal.
     * Claim is ownership-proof only. If a Linked desk token is presented,
     * reject before RegFox verify so Linked session cannot drive escalation.
     */
    const presentedDeskToken = readDeskToken(req, body as { deskToken?: string })
    if (presentedDeskToken) {
      const probeClient = createServiceClient()
      const tokenHash = await sha256Hex(presentedDeskToken)
      const { data: presentedDesk } = await probeClient
        .from('desk_devices')
        .select('id, role, revoked_at')
        .eq('token_hash', tokenHash)
        .maybeSingle()
      if (presentedDesk && presentedDesk.role === 'linked') {
        return errorResponse(
          'A Linked Desktop cannot become Principal using its Linked connection. Prove RegFox ownership independently.',
          403,
        )
      }
    }

    const verified = await verifyRegFoxEventAccess(regfoxApiKey, externalEventId)
    // Clear as soon as verification completes.
    regfoxApiKey = null

    if (!verified.ok) {
      return errorResponse(verified.message, verified.status === 404 ? 404 : verified.status === 401 ? 401 : 502)
    }

    const client = createServiceClient()
    const conferenceName =
      verified.displayName || `RegFox Event ${externalEventId}`

    // Find-or-create by canonical identity (unique index enforces race safety).
    let conferenceId: string | null = null
    let conferenceNameOut = conferenceName

    const { data: existing, error: findError } = await client
      .from('conferences')
      .select('id, name, regfox_event_id, registration_platform, external_event_id')
      .eq('registration_platform', 'regfox')
      .eq('external_event_id', externalEventId)
      .maybeSingle()

    if (findError) {
      return errorResponse(sanitizeMessage(findError.message), 500)
    }

    if (existing) {
      conferenceId = existing.id
      conferenceNameOut = existing.name || conferenceName
      // Keep legacy column in sync for Sprint 21 compatibility.
      if (existing.regfox_event_id !== externalEventId) {
        await client
          .from('conferences')
          .update({
            regfox_event_id: externalEventId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      }
    } else {
      const slug = `regfox-${externalEventId}`
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64)

      const { data: created, error: createError } = await client
        .from('conferences')
        .insert({
          name: conferenceName,
          slug,
          regfox_event_id: externalEventId,
          registration_platform: 'regfox',
          external_event_id: externalEventId,
        })
        .select('id, name')
        .maybeSingle()

      if (createError) {
        // Concurrent create — unique violation: re-select.
        const { data: raced, error: raceError } = await client
          .from('conferences')
          .select('id, name')
          .eq('registration_platform', 'regfox')
          .eq('external_event_id', externalEventId)
          .maybeSingle()

        if (raceError || !raced) {
          return errorResponse(
            sanitizeMessage(createError.message || 'Unable to create FoxBridge Cloud event.'),
            500,
          )
        }
        conferenceId = raced.id
        conferenceNameOut = raced.name || conferenceName
      } else if (!created) {
        return errorResponse('Unable to create FoxBridge Cloud event.', 500)
      } else {
        conferenceId = created.id
        conferenceNameOut = created.name || conferenceName
      }
    }

    if (!conferenceId) {
      return errorResponse('Unable to resolve FoxBridge Cloud event.', 500)
    }

    const confirmTransfer = body.confirmTransfer === true
    const reactivateDeskToken = body.reactivateDeskToken?.trim() || null
    body.reactivateDeskToken = undefined

    /**
     * Same-installation Principal relaunch (Sprint 23.2):
     * After independent RegFox ownership proof, if the caller still holds the
     * active Principal desk token for this conference, rotate the token on the
     * same desk row — do not transfer / create a duplicate Principal.
     */
    if (reactivateDeskToken) {
      const existingHash = await sha256Hex(reactivateDeskToken)
      const conferenceIdKey = String(conferenceId)
      const { data: matchingPrincipal, error: matchError } = await client
        .from('desk_devices')
        .select('id, role, revoked_at, conference_id')
        .eq('token_hash', existingHash)
        .eq('conference_id', conferenceIdKey)
        .maybeSingle()

      if (matchError) {
        return errorResponse(sanitizeMessage(matchError.message), 500)
      }

      if (
        matchingPrincipal &&
        matchingPrincipal.role === 'principal' &&
        matchingPrincipal.revoked_at == null &&
        String(matchingPrincipal.conference_id) === conferenceIdKey
      ) {
        const deskTokenBytes = new Uint8Array(32)
        crypto.getRandomValues(deskTokenBytes)
        const deskToken = [...deskTokenBytes]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
        const tokenHash = await sha256Hex(deskToken)
        const deviceLabel = label || `Principal ${new Date().toISOString().slice(0, 10)}`

        // Require a returned row so a silent 0-row update cannot mint a client
        // token that Cloud will never accept (Sprint 23.2 live-validation blocker).
        const { data: rotated, error: rotateError } = await client
          .from('desk_devices')
          .update({
            token_hash: tokenHash,
            label: deviceLabel,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', matchingPrincipal.id)
          .eq('role', 'principal')
          .is('revoked_at', null)
          .select('id, role, conference_id')
          .maybeSingle()

        if (rotateError) {
          return errorResponse(sanitizeMessage(rotateError.message), 500)
        }
        if (!rotated?.id || rotated.role !== 'principal') {
          return errorResponse(
            'Unable to reactivate Principal desk credential. Try again.',
            500,
          )
        }

        await client.from('desk_device_audit').insert({
          conference_id: conferenceIdKey,
          desk_device_id: matchingPrincipal.id,
          action: 'principal_claimed',
          details: { reason: 'principal_reactivated', revoked_count: 0 },
        })

        return jsonResponse({
          deskToken,
          deskDeviceId: matchingPrincipal.id,
          conferenceId: conferenceIdKey,
          conferenceName: conferenceNameOut,
          regfoxEventId: externalEventId,
          registrationPlatform: 'regfox',
          role: 'principal',
          transferred: false,
          reactivated: true,
          revokedCount: 0,
        })
      }
    }

    const { data: activePrincipal, error: principalLookupError } = await client
      .from('desk_devices')
      .select('id')
      .eq('conference_id', conferenceId)
      .eq('role', 'principal')
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle()

    if (principalLookupError) {
      return errorResponse(sanitizeMessage(principalLookupError.message), 500)
    }

    if (activePrincipal && !confirmTransfer) {
      return jsonResponse(
        {
          error:
            'Another Principal Desktop is already connected for this event. Confirm to make this computer the Principal.',
          needsTransferConfirmation: true,
          conferenceId,
          conferenceName: conferenceNameOut,
        },
        409,
      )
    }

    const deskTokenBytes = new Uint8Array(32)
    crypto.getRandomValues(deskTokenBytes)
    const deskToken = [...deskTokenBytes]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    const tokenHash = await sha256Hex(deskToken)
    const deviceLabel = label || `Principal ${new Date().toISOString().slice(0, 10)}`

    const { data: provisioned, error: provisionError } = await client.rpc(
      'provision_principal_desk_device',
      {
        p_conference_id: conferenceId,
        p_token_hash: tokenHash,
        p_label: deviceLabel,
      },
    )

    if (provisionError) {
      return errorResponse(sanitizeMessage(provisionError.message), 500)
    }

    const row = Array.isArray(provisioned) ? provisioned[0] : provisioned
    if (!row?.desk_device_id) {
      return errorResponse('Unable to provision Principal desk credential.', 500)
    }

    return jsonResponse({
      deskToken,
      deskDeviceId: row.desk_device_id,
      conferenceId,
      conferenceName: conferenceNameOut,
      regfoxEventId: externalEventId,
      registrationPlatform: 'regfox',
      role: 'principal',
      transferred: Boolean(row.transferred),
      revokedCount: Number(row.revoked_count ?? 0),
    })
  } catch (error) {
    regfoxApiKey = null
    return errorResponse(
      sanitizeMessage(
        error instanceof Error ? error.message : 'Unable to claim Principal Desktop.',
      ),
      500,
    )
  }
})
