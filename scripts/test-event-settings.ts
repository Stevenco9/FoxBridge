import assert from 'node:assert/strict'
import {
  createDefaultEventSettingsEntry,
  createEmptyEventSettingsFile,
} from '../src/shared/models/EventSettings.ts'
import {
  applyEventSettingsPatch,
  normalizeEventSettingsEntry,
  normalizeEventSettingsFile,
  normalizeFieldKeys,
} from '../src/shared/settings/normalizeEventSettings.ts'

assert.deepEqual(normalizeFieldKeys([' fullName ', '', 'fullName', 'email', 3, null]), [
  'fullName',
  'email',
])

assert.deepEqual(normalizeFieldKeys(undefined), [])
assert.deepEqual(normalizeFieldKeys('nope'), [])

const defaults = createDefaultEventSettingsEntry()
assert.deepEqual(defaults.attendeeDisplay.fieldKeys, [])

const normalized = normalizeEventSettingsEntry({
  attendeeDisplay: {
    fieldKeys: [' custom:city ', 'purchase:mealPan.fullMealPlan', 'custom:city'],
  },
  unknownFutureSection: { ignored: true },
})
assert.deepEqual(normalized.attendeeDisplay.fieldKeys, [
  'custom:city',
  'purchase:mealPan.fullMealPlan',
])

const patched = applyEventSettingsPatch(normalized, {
  attendeeDisplay: {
    fieldKeys: ['firstName', 'payment.status'],
  },
})
assert.deepEqual(patched.attendeeDisplay.fieldKeys, ['firstName', 'payment.status'])

// Omitted patch sections leave prior values intact.
const patchPartial = applyEventSettingsPatch(patched, {})
assert.deepEqual(patchPartial.attendeeDisplay.fieldKeys, ['firstName', 'payment.status'])

const file = normalizeEventSettingsFile({
  version: 1,
  events: {
    ' 12345 ': {
      attendeeDisplay: { fieldKeys: ['fullName'] },
    },
    '': {
      attendeeDisplay: { fieldKeys: ['should-skip'] },
    },
  },
})
assert.equal(file.version, 1)
assert.ok(file.events['12345'])
assert.deepEqual(file.events['12345'].attendeeDisplay.fieldKeys, ['fullName'])
assert.equal(Object.keys(file.events).includes(''), false)

assert.deepEqual(normalizeEventSettingsFile(null), createEmptyEventSettingsFile())
assert.deepEqual(normalizeEventSettingsEntry(null), createDefaultEventSettingsEntry())

// Round-trip JSON shape stays IPC/serializable.
JSON.stringify(patched)
JSON.stringify(file)

console.log('test-event-settings: ok')
