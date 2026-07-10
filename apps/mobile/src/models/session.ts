export interface VolunteerSession {
  volunteerName: string
  conferenceId: string
  conferenceName: string
  scannerSessionId: string | null
  stationLabel: string | null
  signedInAt: string
}

export interface ConferenceSummary {
  id: string
  name: string
  slug: string | null
}

export interface ScannerCodeValidation {
  sessionId: string
  conferenceId: string
  conferenceName: string
  label: string
}

export interface SignInResult {
  session: VolunteerSession
  skipConferenceSelection: boolean
}

export type AppRoute = 'splash' | 'sign-in' | 'conference' | 'ready'
