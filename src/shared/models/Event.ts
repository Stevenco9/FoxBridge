/**
 * FoxBridge Event — platform-independent event identity.
 *
 * Distinct from a registration platform's event/page id. RegFox (and future
 * platforms) map into this model; Desktop associates Local Event Store rows,
 * Event Settings, and Sync state with `Event.id`.
 */

export type RegistrationPlatform = 'regfox' | (string & {})

export interface Event {
  /** FoxBridge-local stable id (UUID). */
  id: string
  /** Organizer-facing display name. */
  name: string
  /** Registration system that feeds this event. */
  registrationPlatform: RegistrationPlatform
  /** Upstream event/page/form id (e.g. RegFox page id). */
  platformEventId: string
  /** ISO 8601 — when this FoxBridge Event was first created locally. */
  createdAt: string
  /** ISO 8601 — last successful registration sync into the Local Event Store. */
  lastSyncedAt: string | null
}

export interface EnsureEventInput {
  name?: string | null
  registrationPlatform: RegistrationPlatform
  platformEventId: string
  /** When true, bump lastSyncedAt to now (or syncedAt). */
  markSynced?: boolean
  syncedAt?: string | null
}
