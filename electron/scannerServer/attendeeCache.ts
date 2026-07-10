import type { Attendee } from '../../src/shared/models'

let cachedAttendees: Attendee[] = []

export function setAttendeeCache(attendees: Attendee[]): void {
  cachedAttendees = attendees
}

export function getAttendeeCache(): Attendee[] {
  return cachedAttendees
}

export function updateAttendeeInCache(updated: Attendee): void {
  cachedAttendees = cachedAttendees.map((attendee) =>
    attendee.id === updated.id ? updated : attendee,
  )
}

export function isAttendeeCacheLoaded(): boolean {
  return cachedAttendees.length > 0
}

export function getAttendeeCacheCount(): number {
  return cachedAttendees.length
}
