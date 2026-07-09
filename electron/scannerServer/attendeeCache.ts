import type { Attendee } from '../../src/shared/models'

let cachedAttendees: Attendee[] = []

export function setAttendeeCache(attendees: Attendee[]): void {
  cachedAttendees = attendees
}

export function getAttendeeCache(): Attendee[] {
  return cachedAttendees
}

export function isAttendeeCacheLoaded(): boolean {
  return cachedAttendees.length > 0
}

export function getAttendeeCacheCount(): number {
  return cachedAttendees.length
}
