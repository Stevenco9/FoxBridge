import { getSupabaseClient } from '../lib/supabaseClient'
import type { ScannerCodeValidation } from '../models/session'

export class OrganizerTestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrganizerTestError'
  }
}

function toFriendlyError(message: string): string {
  if (message.toLowerCase().includes('no conference')) {
    return 'No conference is set up yet. Load registrations on the desktop first.'
  }

  return 'Unable to start the scanner right now. Try again in a moment.'
}

export async function activateOrganizerTestScanner(): Promise<ScannerCodeValidation> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new OrganizerTestError('Phone scanning is not available right now. Try again later.')
  }

  const { data, error } = await supabase.rpc('activate_organizer_test_scanner')

  if (error) {
    throw new OrganizerTestError(toFriendlyError(error.message))
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.session_id || !row.conference_id || !row.conference_name) {
    throw new OrganizerTestError('Unable to start the scanner right now. Try again in a moment.')
  }

  return {
    sessionId: row.session_id as string,
    conferenceId: row.conference_id as string,
    conferenceName: row.conference_name as string,
    label: (row.label as string | null) ?? 'Organizer test scanner',
  }
}
