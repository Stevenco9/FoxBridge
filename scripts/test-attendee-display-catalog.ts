import assert from 'node:assert/strict'
import type { AvailableAttendeeField } from '../src/shared/attendees/discoverAvailableAttendeeFields.ts'
import {
  findFirstUnusedFieldKey,
  getSelectedKeysExcludingIndex,
  groupAvailableAttendeeFields,
  labelForFieldKey,
} from '../src/features/eventSettings/attendeeDisplayCatalog.ts'

const catalog: AvailableAttendeeField[] = [
  { key: 'firstName', label: 'First Name', dataType: 'string', source: 'built-in' },
  { key: 'fullName', label: 'Full Name', dataType: 'string', source: 'derived' },
  { key: 'payment.status', label: 'Payment Status', dataType: 'string', source: 'payment' },
  {
    key: 'purchase:meal',
    label: 'Meal Plan',
    dataType: 'number',
    source: 'purchase',
    category: 'mealPlan',
  },
  { key: 'custom:city', label: 'City', dataType: 'string', source: 'custom' },
]

const groups = groupAvailableAttendeeFields(catalog)
assert.deepEqual(
  groups.map((group) => group.id),
  ['built-in', 'derived', 'payment', 'purchase', 'custom'],
)
assert.equal(groups.find((group) => group.id === 'custom')?.label, 'Custom Registration')
assert.equal(groups.find((group) => group.id === 'purchase')?.label, 'Purchases')

const taken = getSelectedKeysExcludingIndex(['firstName', 'fullName', 'custom:city'], 1)
assert.equal(taken.has('firstName'), true)
assert.equal(taken.has('fullName'), false)
assert.equal(taken.has('custom:city'), true)

assert.equal(findFirstUnusedFieldKey(catalog, ['firstName', 'fullName']), 'payment.status')
assert.equal(
  findFirstUnusedFieldKey(catalog, catalog.map((field) => field.key)),
  null,
)

// After changing row 0 from firstName → payment.status, firstName is free again.
const configured = ['payment.status', 'fullName']
const afterEdit = getSelectedKeysExcludingIndex(configured, 0)
assert.equal(afterEdit.has('payment.status'), false)
assert.equal(afterEdit.has('fullName'), true)
assert.equal(afterEdit.has('firstName'), false)
assert.equal(findFirstUnusedFieldKey(catalog, configured), 'firstName')

const catalogByKey = new Map(catalog.map((field) => [field.key, field]))
assert.equal(labelForFieldKey(catalogByKey, 'fullName'), 'Full Name')
assert.equal(
  labelForFieldKey(catalogByKey, 'custom:gone.forever'),
  'Unavailable — custom:gone.forever',
)

console.log('test-attendee-display-catalog: ok')
