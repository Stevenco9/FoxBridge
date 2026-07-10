import type { AttendeePayment } from './AttendeePayment'

/**
 * A line item representing something the attendee purchased or registered for
 * (e.g. ticket type, session, meal, add-on).
 */
export interface AttendeePurchase {
  id: string
  name: string
  quantity: number
  category?: string
}

/**
 * A custom field captured during registration.
 * Values are stored as primitives or simple arrays for flexible form data.
 */
export interface AttendeeCustomField {
  key: string
  label: string
  value: string | number | boolean | string[] | null
}

/**
 * FoxBridge's internal attendee model.
 *
 * This shape is independent of any external registration API. Integrations
 * map third-party responses into this interface before data enters Core or
 * the local cache.
 */
export interface Attendee {
  // ---------------------------------------------------------------------------
  // Identifiers
  // ---------------------------------------------------------------------------

  /** FoxBridge-local identifier for this cached attendee record. */
  id: string

  /** Identifier from the upstream registration system. */
  registrationId: string

  /** Human-readable confirmation or reference code, when available. */
  confirmationCode?: string

  /** Event this attendee belongs to. */
  eventId: string

  // ---------------------------------------------------------------------------
  // Contact information
  // ---------------------------------------------------------------------------

  firstName: string
  lastName: string
  email: string
  phone?: string

  // ---------------------------------------------------------------------------
  // Organization
  // ---------------------------------------------------------------------------

  organization?: string
  jobTitle?: string
  department?: string

  // ---------------------------------------------------------------------------
  // Purchases
  // ---------------------------------------------------------------------------

  /** Tickets, sessions, meals, add-ons, and other registered items. */
  purchases: AttendeePurchase[]

  /**
   * Normalized RegFox payment snapshot (read-only in Sprint 16A).
   * Always present after mapping; monetary fields may be null when unknown.
   */
  payment: AttendeePayment

  // ---------------------------------------------------------------------------
  // Custom fields
  // ---------------------------------------------------------------------------

  /** Additional registration form answers not covered by standard fields. */
  customFields: AttendeeCustomField[]

  // ---------------------------------------------------------------------------
  // Check-in status
  // ---------------------------------------------------------------------------

  checkedIn: boolean

  /** ISO 8601 timestamp of when the attendee was checked in. */
  checkedInAt?: string

  // ---------------------------------------------------------------------------
  // Badge printed status
  // ---------------------------------------------------------------------------

  badgePrinted: boolean

  /** ISO 8601 timestamp of when a badge was last printed for this attendee. */
  badgePrintedAt?: string

  // ---------------------------------------------------------------------------
  // Timestamps
  // ---------------------------------------------------------------------------

  /** ISO 8601 timestamp when this record was first created in FoxBridge. */
  createdAt: string

  /** ISO 8601 timestamp when this record was last updated in FoxBridge. */
  updatedAt: string

  /** ISO 8601 timestamp when attendee data was last synced from the source. */
  syncedAt?: string

  // ---------------------------------------------------------------------------
  // Future expansion
  // ---------------------------------------------------------------------------

  /**
   * Open-ended metadata for features not yet modeled explicitly
   * (e.g. meal redemption, volunteer notes, QR payload hints).
   */
  metadata?: Record<string, unknown>
}
