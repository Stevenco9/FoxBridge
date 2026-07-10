export interface CloudStatus {
  configured: boolean
  connected: boolean
  conferenceId: string | null
  conferenceName: string | null
  lastPublishAt: string | null
  lastPublishAttendeeCount: number | null
  lastPublishError: string | null
}

export interface PublishAttendeesResult {
  success: boolean
  attendeeCount: number
  publishedAt: string | null
  error: string | null
}
