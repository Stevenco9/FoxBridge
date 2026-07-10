import type { AttendeePayment, PaymentStatus } from '../models/AttendeePayment'
import { createUnknownPayment } from '../models/AttendeePayment'
import { formatMoney, normalizeCurrencyCode, parseMoneyValue } from './money'

/**
 * Maps a RegFox registrant status string into FoxBridge PaymentStatus.
 */
export function normalizeUpstreamPaymentStatus(
  upstreamStatus: string | null | undefined,
): PaymentStatus {
  if (upstreamStatus == null) {
    return 'unknown'
  }

  const normalized = upstreamStatus
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')

  if (!normalized) {
    return 'unknown'
  }

  if (normalized === 'completed' || normalized === 'paid') {
    return 'paid'
  }

  if (
    normalized === 'pending' ||
    normalized === 'unpaid' ||
    normalized === 'pending offline payment' ||
    normalized === 'pending final payment'
  ) {
    return 'pending'
  }

  if (normalized === 'canceled' || normalized === 'cancelled') {
    return 'cancelled'
  }

  if (normalized === 'refunded' || normalized.includes('refund')) {
    return 'refunded'
  }

  // abandoned, waitlisted, transferred, pending transfer, and unrecognized → unknown
  return 'unknown'
}

function normalizeStatusKey(upstreamStatus: string | null): string {
  if (!upstreamStatus) {
    return ''
  }
  return upstreamStatus
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

/**
 * Statuses where RegFox still expects payment. Live AdAgrA payloads report
 * `outstandingAmount: "0"` for these while `total`/`amount` hold the charge
 * RegFox shows in the UI — so a zero outstanding cannot be trusted as "paid in full".
 */
function isAwaitingPaymentStatus(upstreamStatus: string | null): boolean {
  const normalized = normalizeStatusKey(upstreamStatus)
  return (
    normalized === 'pending' ||
    normalized === 'unpaid' ||
    normalized === 'pending offline payment' ||
    normalized === 'pending final payment'
  )
}

export interface RegFoxPaymentFields {
  status?: unknown
  amount?: unknown
  total?: unknown
  outstandingAmount?: unknown
  currency?: unknown
}

/**
 * Builds a normalized AttendeePayment from confirmed RegFox registrant fields.
 *
 * - Prefers `total` over `amount` for the registration total.
 * - Uses `outstandingAmount` as balance due when it is a positive value
 *   (partial / remaining balance).
 * - For statuses that still await payment, when `outstandingAmount` is missing
 *   or zero, uses the registration total as balance due — matching RegFox UI
 *   for `pending offline payment` on live event data.
 * - Derives `amountPaid` only when both total and balance are known and valid.
 * - Does not sum `fieldData[].amount` line items.
 */
export function mapRegFoxPaymentFields(
  fields: RegFoxPaymentFields | null | undefined,
): AttendeePayment {
  if (!fields) {
    return createUnknownPayment()
  }

  const upstreamStatus =
    typeof fields.status === 'string' && fields.status.trim()
      ? fields.status.trim()
      : fields.status == null
        ? null
        : String(fields.status)

  const totalFromTotal = parseMoneyValue(fields.total)
  const totalFromAmount = parseMoneyValue(fields.amount)
  const totalAmount = totalFromTotal ?? totalFromAmount
  const reportedOutstanding = parseMoneyValue(fields.outstandingAmount)
  const currency = normalizeCurrencyCode(fields.currency)

  let balanceDue: number | null = null
  if (reportedOutstanding != null && reportedOutstanding > 0) {
    // Positive outstanding is authoritative for remaining balance / payment plans.
    balanceDue = reportedOutstanding
  } else if (isAwaitingPaymentStatus(upstreamStatus) && totalAmount != null) {
    // Live RegFox: pending offline payment reports outstandingAmount "0" while
    // total/amount is the amount RegFox displays as still owed.
    balanceDue = totalAmount
  } else if (reportedOutstanding != null) {
    balanceDue = reportedOutstanding
  }

  let amountPaid: number | null = null
  if (totalAmount != null && balanceDue != null) {
    const derived = totalAmount - balanceDue
    if (Number.isFinite(derived) && derived >= 0) {
      amountPaid = derived
    }
  }

  let status = normalizeUpstreamPaymentStatus(upstreamStatus)

  // Positive outstanding balance means unpaid/partial even if status says completed.
  // Do not promote abandoned/waitlisted/unknown to paid just because outstanding is 0.
  if (status !== 'cancelled' && status !== 'refunded' && balanceDue != null && balanceDue > 0) {
    status = 'pending'
  }

  return {
    status,
    totalAmount,
    amountPaid,
    balanceDue,
    currency,
    upstreamStatus,
    source: 'regfox',
  }
}

/** User-facing status label for the current event (pending → Unpaid). */
export function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid'
    case 'pending':
      return 'Unpaid'
    case 'cancelled':
      return 'Cancelled'
    case 'refunded':
      return 'Refunded'
    default:
      return 'Payment unknown'
  }
}

/**
 * Compact list-row indicator. Uses text (not color alone).
 * Examples: "Paid — MX$1,500", "Unpaid — MX$750 due", "Unpaid"
 */
export function formatPaymentListIndicator(payment: AttendeePayment): string {
  const label = getPaymentStatusLabel(payment.status)

  if (payment.status === 'pending' && payment.balanceDue != null && payment.balanceDue > 0) {
    return `${label} — ${formatMoney(payment.balanceDue, payment.currency)} due`
  }

  // Show paid totals only when non-zero (free completed registrations stay "Paid").
  if (payment.status === 'paid' && payment.totalAmount != null && payment.totalAmount > 0) {
    return `${label} — ${formatMoney(payment.totalAmount, payment.currency)}`
  }

  return label
}
