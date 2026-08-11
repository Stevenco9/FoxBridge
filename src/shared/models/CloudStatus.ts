export interface CloudStatus {
  configured: boolean
  connected: boolean
  conferenceId: string | null
  conferenceName: string | null
  lastPublishAt: string | null
  lastPublishAttendeeCount: number | null
  lastPublishError: string | null
  /** Local event-scoped desk credential is present. */
  deskCredentialConfigured: boolean
  /**
   * Technical server message when desk verification fails.
   * Map with classifyFoxBridgeSyncIssue before showing to organizers.
   */
  connectionError: string | null
}

export interface PublishAttendeesResult {
  success: boolean
  attendeeCount: number
  publishedAt: string | null
  error: string | null
}
