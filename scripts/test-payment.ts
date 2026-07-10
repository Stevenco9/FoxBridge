import assert from 'node:assert/strict'
import { mapRegistrantToAttendee } from '../src/integrations/regfox/mapRegistrantToAttendee.ts'
import type { RegFoxRegistrant } from '../src/integrations/regfox/regfoxTypes.ts'
import { formatMoney, normalizeCurrencyCode, parseMoneyValue } from '../src/shared/payments/money.ts'
import {
  formatPaymentListIndicator,
  getPaymentStatusLabel,
  mapRegFoxPaymentFields,
  normalizeUpstreamPaymentStatus,
} from '../src/shared/payments/normalizePayment.ts'

function assertPayment(
  actual: ReturnType<typeof mapRegFoxPaymentFields>,
  expected: Partial<ReturnType<typeof mapRegFoxPaymentFields>>,
): void {
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(
      actual[key as keyof typeof actual],
      value,
      `payment.${key} expected ${String(value)}, got ${String(actual[key as keyof typeof actual])}`,
    )
  }
}

// --- Status normalization ---

assert.equal(normalizeUpstreamPaymentStatus('completed'), 'paid')
assert.equal(normalizeUpstreamPaymentStatus('Paid'), 'paid')
assert.equal(normalizeUpstreamPaymentStatus('pending'), 'pending')
assert.equal(normalizeUpstreamPaymentStatus('unpaid'), 'pending')
assert.equal(normalizeUpstreamPaymentStatus('pending offline payment'), 'pending')
assert.equal(normalizeUpstreamPaymentStatus('pending-final-payment'), 'pending')
assert.equal(normalizeUpstreamPaymentStatus('pending_offline_payment'), 'pending')
assert.equal(normalizeUpstreamPaymentStatus('canceled'), 'cancelled')
assert.equal(normalizeUpstreamPaymentStatus('Cancelled'), 'cancelled')
assert.equal(normalizeUpstreamPaymentStatus('refunded'), 'refunded')
assert.equal(normalizeUpstreamPaymentStatus('partial refund'), 'refunded')
assert.equal(normalizeUpstreamPaymentStatus(null), 'unknown')
assert.equal(normalizeUpstreamPaymentStatus(''), 'unknown')
assert.equal(normalizeUpstreamPaymentStatus('abandoned'), 'unknown')
assert.equal(normalizeUpstreamPaymentStatus('waitlisted'), 'unknown')
assert.equal(normalizeUpstreamPaymentStatus('transferred'), 'unknown')
assert.equal(normalizeUpstreamPaymentStatus('pending transfer'), 'unknown')
assert.equal(normalizeUpstreamPaymentStatus('something-else'), 'unknown')

// abandoned / waitlisted preserve upstreamStatus and must not display as Unpaid
assertPayment(
  mapRegFoxPaymentFields({
    status: 'abandoned',
    total: '1207.50',
    outstandingAmount: '0',
    currency: 'MXN',
  }),
  {
    status: 'unknown',
    upstreamStatus: 'abandoned',
    balanceDue: 0,
    totalAmount: 1207.5,
  },
)
assert.equal(
  formatPaymentListIndicator(
    mapRegFoxPaymentFields({
      status: 'abandoned',
      total: '1207.50',
      outstandingAmount: '0',
      currency: 'MXN',
    }),
  ),
  'Payment unknown',
)

assertPayment(
  mapRegFoxPaymentFields({
    status: 'waitlisted',
    total: '500',
    outstandingAmount: '0',
    currency: 'MXN',
  }),
  {
    status: 'unknown',
    upstreamStatus: 'waitlisted',
  },
)
assert.equal(
  getPaymentStatusLabel(
    mapRegFoxPaymentFields({ status: 'waitlisted', total: '500', outstandingAmount: '0' }).status,
  ),
  'Payment unknown',
)

// --- Money parsing ---

assert.equal(parseMoneyValue('1500'), 1500)
assert.equal(parseMoneyValue('1,500.50'), 1500.5)
assert.equal(parseMoneyValue(750), 750)
assert.equal(parseMoneyValue(0), 0)
assert.equal(parseMoneyValue('0'), 0)
assert.equal(parseMoneyValue(''), null)
assert.equal(parseMoneyValue('   '), null)
assert.equal(parseMoneyValue(null), null)
assert.equal(parseMoneyValue(undefined), null)
assert.equal(parseMoneyValue('MX$750'), null)
assert.equal(parseMoneyValue('abc'), null)
assert.equal(parseMoneyValue(Number.NaN), null)
assert.equal(parseMoneyValue(Number.POSITIVE_INFINITY), null)

assert.equal(normalizeCurrencyCode('mxn'), 'MXN')
assert.equal(normalizeCurrencyCode('USD'), 'USD')
assert.equal(normalizeCurrencyCode(''), null)
assert.equal(normalizeCurrencyCode('US'), null)
assert.equal(normalizeCurrencyCode(null), null)

// --- Paid / full payment with zero balance ---

assertPayment(
  mapRegFoxPaymentFields({
    status: 'completed',
    total: '1500',
    amount: '1500',
    outstandingAmount: '0',
    currency: 'MXN',
  }),
  {
    status: 'paid',
    totalAmount: 1500,
    amountPaid: 1500,
    balanceDue: 0,
    currency: 'MXN',
    upstreamStatus: 'completed',
    source: 'regfox',
  },
)

// Prefer total over amount when both differ
assertPayment(
  mapRegFoxPaymentFields({
    status: 'completed',
    total: '2000',
    amount: '1500',
    outstandingAmount: '0',
    currency: 'USD',
  }),
  {
    status: 'paid',
    totalAmount: 2000,
    amountPaid: 2000,
    balanceDue: 0,
  },
)

// Numeric money values
assertPayment(
  mapRegFoxPaymentFields({
    status: 'completed',
    total: 100,
    outstandingAmount: 0,
    currency: 'USD',
  }),
  {
    status: 'paid',
    totalAmount: 100,
    amountPaid: 100,
    balanceDue: 0,
  },
)

// --- Unpaid / pending ---

assertPayment(
  mapRegFoxPaymentFields({
    status: 'pending offline payment',
    total: '750',
    outstandingAmount: '750',
    currency: 'MXN',
  }),
  {
    status: 'pending',
    totalAmount: 750,
    amountPaid: 0,
    balanceDue: 750,
    currency: 'MXN',
    upstreamStatus: 'pending offline payment',
  },
)

// Live RegFox quirk (AdAgrA): pending offline payment reports outstandingAmount "0"
// while total/amount hold the charge RegFox displays as due.
assertPayment(
  mapRegFoxPaymentFields({
    status: 'pending offline payment',
    total: '1580.00',
    amount: '1580.00',
    outstandingAmount: '0',
    currency: 'MXN',
  }),
  {
    status: 'pending',
    totalAmount: 1580,
    amountPaid: 0,
    balanceDue: 1580,
    currency: 'MXN',
    upstreamStatus: 'pending offline payment',
  },
)

const liveOfflineIndicator = formatPaymentListIndicator(
  mapRegFoxPaymentFields({
    status: 'pending offline payment',
    total: '1580.00',
    amount: '1580.00',
    outstandingAmount: '0',
    currency: 'MXN',
  }),
)
assert.match(liveOfflineIndicator, /^Unpaid — .+ due$/)
assert.ok(
  liveOfflineIndicator.includes('1,580') || liveOfflineIndicator.includes('1580'),
  `expected 1580 in list indicator, got: ${liveOfflineIndicator}`,
)

assert.equal(
  getPaymentStatusLabel(
    mapRegFoxPaymentFields({
      status: 'pending',
      total: '750',
      outstandingAmount: '750',
      currency: 'MXN',
    }).status,
  ),
  'Unpaid',
)

// Completed with positive outstanding → pending (partial / unpaid balance)
assertPayment(
  mapRegFoxPaymentFields({
    status: 'completed',
    total: '1500',
    outstandingAmount: '750',
    currency: 'MXN',
  }),
  {
    status: 'pending',
    totalAmount: 1500,
    amountPaid: 750,
    balanceDue: 750,
  },
)

// Partial payment: positive outstanding wins over total fallback
assertPayment(
  mapRegFoxPaymentFields({
    status: 'pending final payment',
    total: '1580.00',
    outstandingAmount: '500.00',
    currency: 'MXN',
  }),
  {
    status: 'pending',
    totalAmount: 1580,
    amountPaid: 1080,
    balanceDue: 500,
  },
)

// Fully paid completed: zero outstanding must NOT fall back to total as unpaid
assertPayment(
  mapRegFoxPaymentFields({
    status: 'completed',
    total: '1580.00',
    amount: '1580.00',
    outstandingAmount: '0',
    currency: 'MXN',
  }),
  {
    status: 'paid',
    totalAmount: 1580,
    amountPaid: 1580,
    balanceDue: 0,
    currency: 'MXN',
    upstreamStatus: 'completed',
  },
)

// --- Cancelled / refunded ---

assertPayment(
  mapRegFoxPaymentFields({
    status: 'canceled',
    total: '1500',
    outstandingAmount: '0',
    currency: 'MXN',
  }),
  {
    status: 'cancelled',
    upstreamStatus: 'canceled',
  },
)

assertPayment(
  mapRegFoxPaymentFields({
    status: 'cancelled',
    total: '1500',
    outstandingAmount: '1500',
    currency: 'MXN',
  }),
  {
    status: 'cancelled',
  },
)

assertPayment(
  mapRegFoxPaymentFields({
    status: 'refunded',
    total: '1500',
    outstandingAmount: '0',
    currency: 'USD',
  }),
  {
    status: 'refunded',
  },
)

// --- Missing / malformed ---

assertPayment(mapRegFoxPaymentFields({}), {
  status: 'unknown',
  totalAmount: null,
  amountPaid: null,
  balanceDue: null,
  currency: null,
  upstreamStatus: null,
  source: 'regfox',
})

assertPayment(
  mapRegFoxPaymentFields({
    status: 'completed',
    total: 'not-a-number',
    outstandingAmount: 'also-bad',
    currency: 'MX',
  }),
  {
    status: 'paid',
    totalAmount: null,
    amountPaid: null,
    balanceDue: null,
    currency: null,
    upstreamStatus: 'completed',
  },
)

// Do not invent zeros when amounts missing
assertPayment(
  mapRegFoxPaymentFields({
    status: 'pending',
  }),
  {
    status: 'pending',
    totalAmount: null,
    amountPaid: null,
    balanceDue: null,
  },
)

// Invalid derived paid (balance > total) → amountPaid null
assertPayment(
  mapRegFoxPaymentFields({
    status: 'pending',
    total: '100',
    outstandingAmount: '150',
    currency: 'USD',
  }),
  {
    status: 'pending',
    totalAmount: 100,
    amountPaid: null,
    balanceDue: 150,
  },
)

// Fall back to amount when total missing
assertPayment(
  mapRegFoxPaymentFields({
    status: 'completed',
    amount: '900',
    outstandingAmount: '0',
    currency: 'USD',
  }),
  {
    status: 'paid',
    totalAmount: 900,
    amountPaid: 900,
    balanceDue: 0,
  },
)

// --- Display labels ---

assert.equal(getPaymentStatusLabel('paid'), 'Paid')
assert.equal(getPaymentStatusLabel('pending'), 'Unpaid')
assert.equal(getPaymentStatusLabel('cancelled'), 'Cancelled')
assert.equal(getPaymentStatusLabel('refunded'), 'Refunded')
assert.equal(getPaymentStatusLabel('unknown'), 'Payment unknown')

const unpaidWithBalance = mapRegFoxPaymentFields({
  status: 'pending',
  total: '750',
  outstandingAmount: '750',
  currency: 'MXN',
})
assert.match(formatPaymentListIndicator(unpaidWithBalance), /^Unpaid — .+ due$/)
assert.ok(formatPaymentListIndicator(unpaidWithBalance).includes('750'))

const unpaidNoAmount = mapRegFoxPaymentFields({ status: 'pending' })
assert.equal(formatPaymentListIndicator(unpaidNoAmount), 'Unpaid')

const paidWithTotal = mapRegFoxPaymentFields({
  status: 'completed',
  total: '1500',
  outstandingAmount: '0',
  currency: 'MXN',
})
assert.match(formatPaymentListIndicator(paidWithTotal), /^Paid — /)
assert.ok(formatPaymentListIndicator(paidWithTotal).includes('1,500') || formatPaymentListIndicator(paidWithTotal).includes('1500'))

// Free completed registration: "Paid" only — no fake MX$0.00
const freePaid = mapRegFoxPaymentFields({
  status: 'completed',
  total: '0.00',
  amount: '0.00',
  outstandingAmount: '0',
  currency: 'MXN',
})
assert.equal(freePaid.status, 'paid')
assert.equal(freePaid.totalAmount, 0)
assert.equal(freePaid.balanceDue, 0)
assert.equal(formatPaymentListIndicator(freePaid), 'Paid')

// Unknown amounts: no invented zeros in the list label
assert.equal(
  formatPaymentListIndicator(mapRegFoxPaymentFields({ status: 'pending' })),
  'Unpaid',
)

// --- Currency formatting ---

assert.ok(formatMoney(1500, 'MXN').length > 0)
assert.ok(formatMoney(1500, 'USD').includes('1,500') || formatMoney(1500, 'USD').includes('1500'))
assert.equal(formatMoney(Number.NaN, 'USD'), '—')
assert.ok(formatMoney(100, null).includes('100'))
assert.ok(formatMoney(100, 'NOTACURRENCY').includes('100'))

// --- Mapper integration ---

const registrant: RegFoxRegistrant = {
  id: 42,
  status: 'pending offline payment',
  total: '1500',
  amount: '1500',
  outstandingAmount: '1500',
  currency: 'MXN',
  fieldData: [],
}

const attendee = mapRegistrantToAttendee(registrant, 'event-test')
assert.equal(attendee.payment.status, 'pending')
assert.equal(attendee.payment.totalAmount, 1500)
assert.equal(attendee.payment.balanceDue, 1500)
assert.equal(attendee.payment.currency, 'MXN')
assert.equal(attendee.payment.source, 'regfox')
assert.equal(formatPaymentListIndicator(attendee.payment), formatPaymentListIndicator(attendee.payment))

const missingPaymentRegistrant: RegFoxRegistrant = {
  id: 7,
  fieldData: [],
}
const unknownAttendee = mapRegistrantToAttendee(missingPaymentRegistrant, 'event-test')
assert.equal(unknownAttendee.payment.status, 'unknown')
assert.equal(unknownAttendee.payment.totalAmount, null)

console.log('Payment normalization and display tests passed.')
