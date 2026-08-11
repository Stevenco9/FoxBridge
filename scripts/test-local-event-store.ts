import assert from 'node:assert/strict'
import { createUnknownPayment } from '../src/shared/models/AttendeePayment.ts'
import type { Attendee } from '../src/shared/models/Attendee.ts'
import { normalizeStoredAttendee } from '../src/shared/attendees/normalizeStoredAttendee.ts'

const sample: Attendee = {
  id: 'reg-1',
  registrationId: 'reg-1',
  eventId: 'event-99',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '555',
  organization: 'Analytical Engines',
  purchases: [{ id: 't1', name: 'Full', quantity: 1, category: 'ticket' }],
  payment: {
    ...createUnknownPayment(),
    status: 'paid',
    totalAmount: 10,
  },
  customFields: [{ key: 'city', label: 'City', value: 'London' }],
  checkedIn: true,
  checkedInAt: '2026-08-01T12:00:00.000Z',
  badgePrinted: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
  syncedAt: '2026-08-01T12:00:00.000Z',
}

const roundTrip = normalizeStoredAttendee(JSON.parse(JSON.stringify(sample)))
assert.ok(roundTrip)
assert.equal(roundTrip.id, sample.id)
assert.equal(roundTrip.eventId, sample.eventId)
assert.equal(roundTrip.purchases.length, 1)
assert.equal(roundTrip.customFields[0]?.value, 'London')
assert.equal(roundTrip.payment.status, 'paid')
assert.equal(roundTrip.checkedIn, true)

assert.equal(normalizeStoredAttendee(null), null)
assert.equal(normalizeStoredAttendee({ id: 'x' }), null)

console.log('test-local-event-store: ok')
