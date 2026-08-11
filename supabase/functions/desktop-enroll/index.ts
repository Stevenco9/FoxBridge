import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  sha256Hex,
} from '../_shared/deskAuth.ts'

interface EnrollBody {
  enrollmentCode?: string
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
    const body = (await req.json()) as EnrollBody
    const enrollmentCode = body.enrollmentCode?.trim().toUpperCase()
    if (!enrollmentCode) {
      return errorResponse('Enrollment code is required.')
    }

    const client = createServiceClient()
    const codeHash = await sha256Hex(enrollmentCode)
    const nowIso = new Date().toISOString()

    const { data: codeRow, error: codeError } = await client
      .from('desk_enrollment_codes')
      .select('id, conference_id, expires_at, used_at, label')
      .eq('code_hash', codeHash)
      .maybeSingle()

    if (codeError) {
      return errorResponse(codeError.message, 500)
    }

    if (!codeRow) {
      return errorResponse('Enrollment code is invalid.', 401)
    }

    if (codeRow.used_at) {
      return errorResponse('Enrollment code has already been used.', 409)
    }

    if (new Date(codeRow.expires_at).getTime() <= Date.now()) {
      return errorResponse('Enrollment code has expired.', 410)
    }

    const deskTokenBytes = new Uint8Array(32)
    crypto.getRandomValues(deskTokenBytes)
    const deskToken = [...deskTokenBytes]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    const tokenHash = await sha256Hex(deskToken)
    const label =
      body.label?.trim() ||
      codeRow.label ||
      `Desktop ${new Date().toISOString().slice(0, 10)}`

    const { data: deskDevice, error: deskError } = await client
      .from('desk_devices')
      .insert({
        conference_id: codeRow.conference_id,
        token_hash: tokenHash,
        label,
      })
      .select('id, conference_id')
      .single()

    if (deskError || !deskDevice) {
      return errorResponse(deskError?.message ?? 'Unable to create desk credential.', 500)
    }

    const { data: consumed, error: consumeError } = await client
      .from('desk_enrollment_codes')
      .update({
        used_at: nowIso,
        used_by_desk_device_id: deskDevice.id,
      })
      .eq('id', codeRow.id)
      .is('used_at', null)
      .select('id')
      .maybeSingle()

    if (consumeError) {
      await client.from('desk_devices').delete().eq('id', deskDevice.id)
      return errorResponse(consumeError.message, 500)
    }

    if (!consumed) {
      await client.from('desk_devices').delete().eq('id', deskDevice.id)
      return errorResponse('Enrollment code has already been used.', 409)
    }

    const { data: conference } = await client
      .from('conferences')
      .select('id, name, regfox_event_id')
      .eq('id', deskDevice.conference_id)
      .maybeSingle()

    return jsonResponse({
      deskToken,
      deskDeviceId: deskDevice.id,
      conferenceId: deskDevice.conference_id,
      conferenceName: conference?.name ?? null,
      regfoxEventId: conference?.regfox_event_id ?? null,
    })
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Unable to enroll desktop.',
      500,
    )
  }
})
