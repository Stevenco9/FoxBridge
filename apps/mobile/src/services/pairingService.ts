import { getSupabaseClient } from '../lib/supabaseClient'
import type { ScannerCodeValidation } from '../models/session'

export class PairingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PairingError'
  }
}

export async function exchangePairingToken(token: string): Promise<ScannerCodeValidation> {
  const trimmed = token.trim()
  if (!trimmed) {
    throw new PairingError('Pairing code is missing.')
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new PairingError('Phone scanning is not configured on this device.')
  }

  const { data, error } = await supabase.rpc('exchange_scanner_pairing_token', {
    p_token: trimmed,
  })

  if (error) {
    const message = error.message.includes('invalid, expired, or already used')
      ? 'This pairing code is invalid, expired, or already used.'
      : 'Unable to connect to the conference. Ask the organizer for a new code.'
    throw new PairingError(message)
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.session_id || !row.conference_id || !row.conference_name) {
    throw new PairingError('Unable to connect to the conference. Ask the organizer for a new code.')
  }

  return {
    sessionId: row.session_id as string,
    conferenceId: row.conference_id as string,
    conferenceName: row.conference_name as string,
    label: (row.label as string | null) ?? 'Phone scanner',
  }
}
