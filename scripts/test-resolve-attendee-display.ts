import assert from 'node:assert/strict'
import { createUnknownPayment } from '../src/shared/models/AttendeePayment.ts'
import type { Attendee } from '../src/shared/models/Attendee.ts'
import {
  formatAttendeeDisplayPrimitive,
  formatPurchaseQuantity,
  resolveAttendeeDisplayItems,
  resolveAttendeeDisplayValue,
  resolveDisplayLabel,
} from '../src/shared/attendees/resolveAttendeeDisplayValue.ts'
import type { AvailableAttendeeField } from '../src/shared/attendees/discoverAvailableAttendeeFields.ts'

function makeAttendee(partial: Partial<Attendee> & Pick<Attendee, 'id'>): Attendee {
  const now = '2026-08-01T00:00:00.000Z'
  return {
    registrationId: partial.registrationId ?? partial.id,
    eventId: 'event-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    purchases: [],
    payment: createUnknownPayment(),
    customFields: [],
    checkedIn: false,
    badgePrinted: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

assert.equal(formatPurchaseQuantity(0), null)
assert.equal(formatPurchaseQuantity(1), 'Purchased')
assert.equal(formatPurchaseQuantity(3), '3 Purchased')

assert.deepEqual(formatAttendeeDisplayPrimitive(null), { kind: 'empty' })
assert.deepEqual(formatAttendeeDisplayPrimitive(false), { kind: 'empty' })
assert.deepEqual(formatAttendeeDisplayPrimitive(''), { kind: 'empty' })
assert.deepEqual(formatAttendeeDisplayPrimitive([]), { kind: 'empty' })
assert.deepEqual(formatAttendeeDisplayPrimitive(true), {
  kind: 'lines',
  lines: ['✓ Yes'],
})
assert.deepEqual(formatAttendeeDisplayPrimitive(['Vegan', 'Nut-free']), {
  kind: 'lines',
  lines: ['Vegan', 'Nut-free'],
})

const attendee = makeAttendee({
  id: '1',
  phone: '',
  organization: 'Analytical Engines',
  checkedIn: true,
  customFields: [
    { key: 'dietary', label: 'Dietary Notes', value: ['Vegan', ''] },
    { key: 'volunteer', label: 'Volunteer', value: false },
  ],
  purchases: [
    { id: 'book-1', name: 'Consejos sobre Agricultura', quantity: 1, category: 'registration' },
    { id: 'merch-2', name: 'T-Shirt', quantity: 2, category: 'registration' },
    { id: 'zero', name: 'Nothing', quantity: 0 },
  ],
})

assert.deepEqual(resolveAttendeeDisplayValue(attendee, 'fullName'), {
  kind: 'lines',
  lines: ['Ada Lovelace'],
})
assert.deepEqual(resolveAttendeeDisplayValue(attendee, 'phone'), { kind: 'empty' })
assert.deepEqual(resolveAttendeeDisplayValue(attendee, 'checkedIn'), {
  kind: 'lines',
  lines: ['✓ Yes'],
})
assert.deepEqual(resolveAttendeeDisplayValue(attendee, 'purchase:book-1'), {
  kind: 'lines',
  lines: ['Purchased'],
})
assert.deepEqual(resolveAttendeeDisplayValue(attendee, 'purchase:merch-2'), {
  kind: 'lines',
  lines: ['2 Purchased'],
})
assert.deepEqual(resolveAttendeeDisplayValue(attendee, 'purchase:zero'), { kind: 'empty' })
assert.deepEqual(resolveAttendeeDisplayValue(attendee, 'purchase:missing'), { kind: 'empty' })
assert.deepEqual(resolveAttendeeDisplayValue(attendee, 'custom:dietary'), {
  kind: 'lines',
  lines: ['Vegan'],
})
assert.deepEqual(resolveAttendeeDisplayValue(attendee, 'custom:volunteer'), { kind: 'empty' })

const catalog: AvailableAttendeeField[] = [
  { key: 'organization', label: 'Organization', dataType: 'string', source: 'built-in' },
  { key: 'phone', label: 'Phone', dataType: 'string', source: 'built-in' },
  {
    key: 'purchase:book-1',
    label: 'Consejos sobre Agricultura',
    dataType: 'number',
    source: 'purchase',
  },
]

const items = resolveAttendeeDisplayItems(
  attendee,
  ['organization', 'phone', 'purchase:book-1', 'purchase:missing'],
  new Map(catalog.map((field) => [field.key, field])),
)

assert.deepEqual(
  items.map((item) => ({ key: item.key, label: item.label, lines: item.lines })),
  [
    { key: 'organization', label: 'Organization', lines: ['Analytical Engines'] },
    {
      key: 'purchase:book-1',
      label: 'Consejos sobre Agricultura',
      lines: ['Purchased'],
    },
  ],
)

// Stale catalog key that still has a purchase on the attendee uses the live purchase name.
assert.equal(
  resolveDisplayLabel(attendee, 'purchase:book-1', new Map()),
  'Consejos sobre Agricultura',
)
assert.equal(
  resolveDisplayLabel(attendee, 'custom:nope', new Map()),
  'Unavailable — custom:nope',
)

// Large configured lists skip empty values but keep order of meaningful ones.
const manyKeys = [
  'organization',
  'phone',
  'checkedIn',
  'purchase:zero',
  'purchase:merch-2',
  'custom:volunteer',
  'custom:dietary',
]
const manyItems = resolveAttendeeDisplayItems(
  attendee,
  manyKeys,
  new Map([
    ...catalog.map((field) => [field.key, field] as const),
    ['checkedIn', { key: 'checkedIn', label: 'Checked In', dataType: 'boolean', source: 'built-in' }],
    ['purchase:merch-2', { key: 'purchase:merch-2', label: 'T-Shirt', dataType: 'number', source: 'purchase' }],
    ['custom:dietary', { key: 'custom:dietary', label: 'Dietary Notes', dataType: 'string[]', source: 'custom' }],
  ]),
)
assert.deepEqual(
  manyItems.map((item) => item.key),
  ['organization', 'checkedIn', 'purchase:merch-2', 'custom:dietary'],
)

console.log('test-resolve-attendee-display: ok')
