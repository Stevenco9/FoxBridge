import { getSupabaseClient } from '../lib/supabaseClient'
import type { SignInResult, VolunteerSession } from '../models/session'
import { validateScannerCode } from './conferenceService'
import { saveVolunteerSession } from './sessionStore'

function getDevAccessCode(): string | null {
  const value = import.meta.env.VITE_MOBILE_ACCESS_CODE?.trim()
  return value || null
}

function buildSession(
  volunteerName: string,
  conferenceId: string,
  conferenceName: string,
  scannerSessionId: string | null,
  stationLabel: string | null,
): VolunteerSession {
  return {
    volunteerName: volunteerName.trim(),
    conferenceId,
    conferenceName,
    scannerSessionId,
    stationLabel,
    signedInAt: new Date().toISOString(),
  }
}

export async function signInVolunteer(
  volunteerName: string,
  accessCode: string,
): Promise<SignInResult> {
  const name = volunteerName.trim()
  const code = accessCode.trim()

  if (!name) {
    throw new Error('Enter your name so other volunteers know who validated meals.')
  }

  if (!code) {
    throw new Error('Enter the scanner code provided by registration staff.')
  }

  let scannerValidation = null
  if (getSupabaseClient()) {
    try {
      scannerValidation = await validateScannerCode(code)
    } catch {
      // Scanner RPC may be unavailable during foundation testing.
    }
  }

  if (scannerValidation) {
    const session = buildSession(
      name,
      scannerValidation.conferenceId,
      scannerValidation.conferenceName,
      scannerValidation.sessionId,
      scannerValidation.label,
    )
    saveVolunteerSession(session)
    return { session, skipConferenceSelection: true }
  }

  const devAccessCode = getDevAccessCode()
  if (devAccessCode && code === devAccessCode) {
    const session = buildSession(name, '', '', null, null)
    saveVolunteerSession(session)
    return { session, skipConferenceSelection: false }
  }

  throw new Error('Invalid scanner code. Check with registration staff and try again.')
}

export function attachConferenceToSession(
  session: VolunteerSession,
  conferenceId: string,
  conferenceName: string,
): VolunteerSession {
  const nextSession = {
    ...session,
    conferenceId,
    conferenceName,
  }
  saveVolunteerSession(nextSession)
  return nextSession
}
