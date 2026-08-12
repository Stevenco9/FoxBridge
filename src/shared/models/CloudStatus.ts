/** Local/Cloud desk role for organizer status (Sprint 22.2). */
export type CloudDeskRole = 'principal' | 'linked' | 'legacy'

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
  /**
   * Desk role from local secrets (refreshed from Cloud on resolve when available).
   * Null when unknown (older installs before role was stored).
   */
  deskRole: CloudDeskRole | null
  /** Linked desk expiry (ISO); null for Principal/legacy/unknown. */
  deskExpiresAt: string | null
}

export interface PublishAttendeesResult {
  success: boolean
  attendeeCount: number
  publishedAt: string | null
  error: string | null
}
