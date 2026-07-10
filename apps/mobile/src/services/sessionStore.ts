import type { VolunteerSession } from '../models/session'

const STORAGE_KEY = 'foxbridge.mobile.session'

export function loadVolunteerSession(): VolunteerSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as VolunteerSession
    if (!parsed.volunteerName || !parsed.conferenceId || !parsed.conferenceName) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function saveVolunteerSession(session: VolunteerSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearVolunteerSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasCompleteSession(session: VolunteerSession | null): session is VolunteerSession {
  return Boolean(session?.volunteerName && session.conferenceId && session.conferenceName)
}
