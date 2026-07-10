/**
 * Normalized registration payment snapshot from RegFox (read-only in Sprint 16A).
 */

export type PaymentStatus =
  | 'paid'
  | 'pending'
  | 'cancelled'
  | 'refunded'
  | 'unknown'

export type PaymentSource = 'regfox'

/**
 * FoxBridge payment view of a registrant.
 *
 * Monetary fields use `null` when unknown — never invent zeros for missing data.
 * `pending` is the internal unpaid/partial-balance status; UI may label it "Unpaid".
 */
export interface AttendeePayment {
  status: PaymentStatus
  totalAmount: number | null
  amountPaid: number | null
  balanceDue: number | null
  currency: string | null
  /** Original RegFox registrant status string, when present. */
  upstreamStatus: string | null
  source: PaymentSource
}

export function createUnknownPayment(): AttendeePayment {
  return {
    status: 'unknown',
    totalAmount: null,
    amountPaid: null,
    balanceDue: null,
    currency: null,
    upstreamStatus: null,
    source: 'regfox',
  }
}
