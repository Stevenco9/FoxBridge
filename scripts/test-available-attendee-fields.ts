import assert from 'node:assert/strict'
import { createUnknownPayment } from '../src/shared/models/AttendeePayment.ts'
import type { Attendee } from '../src/shared/models/Attendee.ts'
import {
  customAttendeeFieldKey,
  discoverAvailableAttendeeFields,
  getStaticAvailableAttendeeFields,
  purchaseAttendeeFieldKey,
} from '../src/shared/attendees/discoverAvailableAttendeeFields.ts'

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

// Static catalog is non-empty and JSON-serializable (IPC-ready shape).
const staticFields = getStaticAvailableAttendeeFields()
assert.ok(staticFields.length >= 20)
for (const field of staticFields) {
  assert.equal(typeof field.key, 'string')
  assert.equal(typeof field.label, 'string')
  assert.ok(['string', 'number', 'boolean', 'string[]', 'unknown'].includes(field.dataType))
  assert.ok(['built-in', 'derived', 'payment', 'custom', 'purchase'].includes(field.source))
  JSON.stringify(field)
}

// Empty attendee list still returns static fields only.
const emptyDiscovery = discoverAvailableAttendeeFields({ attendees: [] })
assert.deepEqual(
  emptyDiscovery.map((field) => field.key),
  staticFields.map((field) => field.key),
)
assert.ok(emptyDiscovery.every((field) => field.source !== 'custom'))
assert.ok(emptyDiscovery.every((field) => field.source !== 'purchase'))

const attendees: Attendee[] = [
  makeAttendee({
    id: '1',
    customFields: [
      { key: 'address.city', label: 'City', value: 'Monterrey' },
      { key: 'dietary', label: 'Dietary Notes', value: 'Vegetarian' },
    ],
    purchases: [
      { id: 'level-full', name: 'Full Registration', quantity: 1, category: 'ticket' },
      {
        id: 'mealPan.fullMealPlan',
        name: 'Full Meal Plan',
        quantity: 1,
        category: 'mealPlan',
      },
    ],
  }),
  makeAttendee({
    id: '2',
    customFields: [
      { key: 'address.city', label: 'City', value: 'Guadalajara' },
      { key: 'dietary', label: 'Dietary Notes', value: ['Vegan', 'Nut-free'] },
      { key: 'tshirt.size', label: 'T-Shirt Size', value: 'M' },
    ],
    purchases: [
      {
        id: 'complementos.libroConsejos',
        name: 'Libro de Consejos sobre Agricultura',
        quantity: 1,
        category: 'registration',
      },
      {
        id: 'mealPan.fullMealPlan',
        name: 'Full Meal Plan',
        quantity: 1,
        category: 'mealPlan',
      },
    ],
  }),
]

const discovered = discoverAvailableAttendeeFields({ attendees })
const byKey = new Map(discovered.map((field) => [field.key, field]))

// Built-in / derived still present.
assert.ok(byKey.has('firstName'))
assert.ok(byKey.has('fullName'))
assert.ok(byKey.has('payment.status'))

// Custom union across attendees.
const city = byKey.get(customAttendeeFieldKey('address.city'))
assert.ok(city)
assert.equal(city.source, 'custom')
assert.equal(city.label, 'City')
assert.equal(city.dataType, 'string')

const dietary = byKey.get(customAttendeeFieldKey('dietary'))
assert.ok(dietary)
assert.equal(dietary.dataType, 'unknown') // string vs string[]

const shirt = byKey.get(customAttendeeFieldKey('tshirt.size'))
assert.ok(shirt)
assert.equal(shirt.dataType, 'string')

// Purchase union includes tickets, meal plans, merchandise/books.
const ticket = byKey.get(purchaseAttendeeFieldKey('level-full'))
assert.ok(ticket)
assert.equal(ticket.source, 'purchase')
assert.equal(ticket.category, 'ticket')
assert.equal(ticket.dataType, 'number')

const mealPlan = byKey.get(purchaseAttendeeFieldKey('mealPan.fullMealPlan'))
assert.ok(mealPlan)
assert.equal(mealPlan.category, 'mealPlan')

const book = byKey.get(purchaseAttendeeFieldKey('complementos.libroConsejos'))
assert.ok(book)
assert.match(book.label, /Consejos/i)

// No duplicate keys.
assert.equal(discovered.length, new Set(discovered.map((field) => field.key)).size)

console.log('test-available-attendee-fields: ok')
console.log(`  static=${staticFields.length} discovered=${discovered.length}`)
