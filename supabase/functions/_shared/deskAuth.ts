import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export interface DeskDeviceRow {
  id: string
  conference_id: string
  revoked_at: string | null
  expires_at: string | null
  label: string | null
  /** principal | linked | legacy (Sprint 22.1). */
  role: string
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-foxbridge-desk-token',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status)
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    throw new Error('FoxBridge Cloud service configuration is missing.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function readDeskToken(req: Request, body?: { deskToken?: string }): string | null {
  const header = req.headers.get('x-foxbridge-desk-token')?.trim()
  if (header) {
    return header
  }

  const fromBody = body?.deskToken?.trim()
  return fromBody || null
}

/**
 * Resolves and validates an event-scoped desk device from the presented token.
 * Rejects revoked / expired credentials. Updates last_used_at.
 */
export async function requireDeskDevice(
  client: SupabaseClient,
  deskToken: string | null,
): Promise<DeskDeviceRow> {
  if (!deskToken) {
    throw new Response(JSON.stringify({ error: 'Desk credential is required.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const tokenHash = await sha256Hex(deskToken)
  const { data, error } = await client
    .from('desk_devices')
    .select('id, conference_id, revoked_at, expires_at, label, role')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    throw new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!data) {
    throw new Response(JSON.stringify({ error: 'Desk credential is invalid.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (data.revoked_at) {
    throw new Response(JSON.stringify({ error: 'Desk credential has been revoked.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Response(JSON.stringify({ error: 'Desk credential has expired.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const role = typeof data.role === 'string' && data.role.trim() ? data.role.trim() : 'legacy'
  if (role !== 'principal' && role !== 'linked' && role !== 'legacy') {
    throw new Response(JSON.stringify({ error: 'Desk credential role is invalid.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await client
    .from('desk_devices')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return {
    ...(data as DeskDeviceRow),
    role,
  }
}

/**
 * Principal-only gate for privileged Edge Functions (device management, attendee publish).
 * Linked and legacy desks intentionally cannot perform these ops.
 */
export function assertPrincipalRole(
  desk: DeskDeviceRow,
  message = 'Only the Principal Desktop can manage conference devices.',
): void {
  if (desk.role !== 'principal') {
    throw new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

/** Ensures callers cannot target a conference other than the desk binding. */
export function assertConferenceScope(
  desk: DeskDeviceRow,
  requestedConferenceId: string | null | undefined,
): string {
  const requested = requestedConferenceId?.trim()
  if (requested && requested !== desk.conference_id) {
    throw new Response(
      JSON.stringify({
        error: 'Desk credential is not authorized for that FoxBridge Cloud event.',
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  return desk.conference_id
}
