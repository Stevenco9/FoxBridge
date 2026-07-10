import type { Attendee } from './Attendee'

export interface AttendeeCheckInResult {
  success: boolean
  attendee: Attendee | null
  alreadyCheckedIn: boolean
  message: string | null
}
