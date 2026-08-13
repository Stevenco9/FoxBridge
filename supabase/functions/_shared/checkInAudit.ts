import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export type CheckInAuditAction =
  | 'attendee_checked_in'
  | 'attendee_check_in_duplicate'
  | 'upstream_check_in_synced'
  | 'upstream_check_in_failed'

/**
 * Best-effort audit insert. Never throws — callers must not fail check-in on audit errors.
 */
export async function insertCheckInAuditBestEffort(
  client: SupabaseClient,
  input: {
    conferenceId: string
    attendeeId: string
    action: CheckInAuditAction
    deskDeviceId?: string | null
    platformId?: string | null
    details?: Record<string, unknown>
  },
): Promise<void> {
  try {
    const details = input.details ?? {}
    // Strip anything that looks like a secret key name.
    const safeDetails: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(details)) {
      const lower = key.toLowerCase()
      if (
        lower.includes('token') ||
        lower.includes('api_key') ||
        lower.includes('apikey') ||
        lower.includes('password') ||
        lower.includes('secret') ||
        lower.includes('service_role')
      ) {
        continue
      }
      if (typeof value === 'string' && value.length > 200) {
        safeDetails[key] = value.slice(0, 200)
        continue
      }
      safeDetails[key] = value
    }

    const { error } = await client.from('conference_attendee_check_in_audit').insert({
      conference_id: input.conferenceId,
      attendee_id: input.attendeeId,
      action: input.action,
      desk_device_id: input.deskDeviceId ?? null,
      platform_id: input.platformId ?? null,
      details: safeDetails,
    })

    if (error) {
      console.warn(
        '[check-in-audit]',
        JSON.stringify({
          action: input.action,
          conferenceId: input.conferenceId,
          attendeeId: input.attendeeId,
          message: error.message,
        }),
      )
    }
  } catch (error) {
    console.warn(
      '[check-in-audit]',
      error instanceof Error ? error.message : String(error),
    )
  }
}
