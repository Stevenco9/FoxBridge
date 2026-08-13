import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAttendeePublishPayload } from '../electron/cloud/buildPublishPayload.ts'
import { mapCloudPublishedAttendeesToFoxBridge } from '../src/shared/attendees/mapCloudPublishedAttendees.ts'
import {
  OPERATIONAL_SNAPSHOT_VERSION,
  OPERATIONAL_SNAPSHOT_EXCLUSIONS,
  buildOperationalJsonV1,
} from '../src/shared/attendees/operationalAttendeeSnapshot.ts'
import { shouldReplaceLocalAttendeesFromCloudSnapshot } from '../src/shared/attendees/cloudAttendeeSnapshotAuthority.ts'
import { discoverAvailableAttendeeFields } from '../src/shared/attendees/discoverAvailableAttendeeFields.ts'
import { resolveAttendeeDisplayValue } from '../src/shared/attendees/resolveAttendeeDisplayValue.ts'
import { getAvailableBadgeFields } from '../src/features/badge/badgeFields.ts'
import type { Attendee } from '../src/shared/models/Attendee.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

assert.equal(typeof buildOperationalJsonV1, 'function')
assert.equal(OPERATIONAL_SNAPSHOT_VERSION, 1)
assert.ok(OPERATIONAL_SNAPSHOT_EXCLUSIONS.length > 0)

const rich: Attendee = {
  id: 'reg-100',
  registrationId: 'reg-100',
  confirmationCode: 'CONF-100',
  eventId: 'event-a',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '+1-555-0100',
  organization: 'Analytical Engines',
  jobTitle: 'Mathematician',
  department: 'Research',
  purchases: [
    { id: 'ticket.full', name: 'Full Conference', quantity: 1, category: 'ticket' },
    { id: 'mealPan.fridayLunch', name: 'Friday lunch', quantity: 1, category: 'individualMeal' },
    { id: 'book.agriculture', name: 'Agriculture Book', quantity: 1, category: 'merchandise' },
  ],
  payment: {
    status: 'paid',
    totalAmount: 250,
    amountPaid: 250,
    balanceDue: 0,
    currency: 'USD',
    upstreamStatus: 'complete',
    source: 'regfox',
  },
  customFields: [
    { key: 'city', label: 'City', value: 'London' },
    { key: 'state', label: 'State', value: 'England' },
    { key: 'dietary', label: 'Dietary notes', value: 'Vegetarian' },
  ],
  checkedIn: true,
  checkedInAt: '2026-08-12T15:00:00.000Z',
  badgePrinted: true,
  badgePrintedAt: '2026-08-12T15:05:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-12T15:00:00.000Z',
  syncedAt: '2026-08-12T14:00:00.000Z',
}

// A. Principal publish serializes approved fields
const published = buildAttendeePublishPayload(rich, 'conf-a', '2026-08-13T04:00:00.000Z')
assert.equal(published.attendee.snapshot_version, 1)
assert.equal(published.attendee.phone, '+1-555-0100')
assert.equal(published.attendee.organization, 'Analytical Engines')
assert.equal(published.attendee.job_title, 'Mathematician')
assert.equal(published.attendee.department, 'Research')
assert.equal(published.attendee.confirmation_code, 'CONF-100')
assert.equal(published.attendee.payment_status, 'paid')
assert.equal(published.attendee.payment_total, 250)
assert.equal(published.attendee.payment_paid, 250)
assert.equal(published.attendee.payment_balance, 0)
assert.equal(published.attendee.payment_currency, 'USD')
assert.equal(published.attendee.checked_in, true)
assert.equal(published.attendee.checked_in_at, '2026-08-12T15:00:00.000Z')
assert.equal(published.attendee.operational_json.v, 1)
assert.equal(published.attendee.operational_json.firstName, 'Ada')
assert.equal(published.attendee.operational_json.purchases.length, 3)
assert.equal(published.attendee.operational_json.customFields.length, 3)
assert.ok(published.mealEntitlements.length >= 1)

// B–F. Linked reconstructs operational Attendee
const linked = mapCloudPublishedAttendeesToFoxBridge({
  foxbridgeEventId: 'event-linked-a',
  attendees: [published.attendee],
  entitlements: published.mealEntitlements.map((row) => ({
    attendee_id: row.attendee_id,
    meal_key: row.meal_key,
    meal_label: row.meal_label,
    source: row.source,
    source_plan_id: row.source_plan_id,
  })),
  syncedAt: '2026-08-13T04:01:00.000Z',
})
assert.equal(linked.length, 1)
const L = linked[0]!
assert.equal(L.firstName, 'Ada')
assert.equal(L.lastName, 'Lovelace')
assert.equal(L.email, 'ada@example.com')
assert.equal(L.phone, '+1-555-0100')
assert.equal(L.organization, 'Analytical Engines')
assert.equal(L.jobTitle, 'Mathematician')
assert.equal(L.department, 'Research')
assert.equal(L.confirmationCode, 'CONF-100')
assert.equal(L.payment.status, 'paid')
assert.equal(L.payment.totalAmount, 250)
assert.equal(L.payment.amountPaid, 250)
assert.equal(L.payment.balanceDue, 0)
assert.equal(L.payment.currency, 'USD')
assert.equal(L.checkedIn, true)
assert.equal(L.checkedInAt, '2026-08-12T15:00:00.000Z')
assert.ok(L.purchases.some((p) => p.id === 'ticket.full'))
assert.ok(L.purchases.some((p) => p.id === 'book.agriculture'))
assert.ok(L.purchases.some((p) => p.id === 'mealPan.fridayLunch'))
assert.equal(L.customFields.length, 3)
assert.equal(L.badgePrinted, false, 'badge print history stays local')

// G. Quick Info field discovery / resolution
const fields = discoverAvailableAttendeeFields({ attendees: [L] })
const fieldKeys = fields.map((f) => f.key)
assert.ok(fieldKeys.includes('custom:city'), `keys=${fieldKeys.join(',')}`)
assert.ok(fieldKeys.includes('purchase:ticket.full'))
assert.ok(fieldKeys.includes('payment.status'))
assert.ok(fieldKeys.includes('organization'))

const cityResolved = resolveAttendeeDisplayValue(L, 'custom:city')
assert.notEqual(cityResolved.kind, 'empty')
if (cityResolved.kind === 'lines') {
  assert.ok(cityResolved.lines.some((line) => line.includes('London')))
} else if (cityResolved.kind === 'text') {
  assert.ok(String(cityResolved.text).includes('London'))
}

const ticketResolved = resolveAttendeeDisplayValue(L, 'purchase:ticket.full')
assert.notEqual(ticketResolved.kind, 'empty')

// H. Badge picker
const badgeOptions = getAvailableBadgeFields(L)
const badgeIds = badgeOptions.map((o) => o.id)
assert.ok(badgeIds.includes('full-name'))
assert.ok(badgeIds.includes('organization'))
assert.ok(badgeIds.includes('city-state') || badgeIds.some((id) => id.includes('city')))
assert.ok(
  badgeIds.includes('registration-type') ||
    badgeIds.some((id) => id.includes('ticket') || id.includes('purchase')),
)

// I. Principal never Cloud-replaced after schema expansion
assert.equal(
  shouldReplaceLocalAttendeesFromCloudSnapshot({
    deskRole: 'principal',
    unlockMethod: 'principal',
    hasRegFoxRegistrationAuthority: true,
  }),
  false,
)

// J. Linked cannot publish — Desktop + Edge
const publishRepo = read('electron/cloud/publishAttendeesRepository.ts')
assert.equal(publishRepo.includes("desk.role !== 'principal'"), true)
const publishEdge = read('supabase/functions/desktop-publish/index.ts')
assert.equal(publishEdge.includes('assertPrincipalRole'), true)
assert.equal(
  publishEdge.includes('Only the Principal Desktop can publish the event attendee snapshot.'),
  true,
)

// K. Linked pairing does not RegFox/publish
const pairing = read('electron/mobile/pairingRepository.ts')
assert.equal(pairing.includes("desk?.role === 'linked'"), true)
assert.equal(pairing.includes('hydrateAttendeesFromCloudForSession'), true)
assert.equal(pairing.includes('Linked must never publish'), true)

// L / M / O
assert.equal(read('supabase/functions/desktop-pull-attendees/index.ts').includes('PAGE_SIZE'), true)
assert.equal(read('supabase/functions/desktop-pull-attendees/index.ts').includes('operational_json'), true)

const legacy = mapCloudPublishedAttendeesToFoxBridge({
  foxbridgeEventId: 'event-legacy',
  attendees: [
    {
      attendee_id: 'x1',
      registration_id: 'x1',
      display_name: 'Legacy Person',
      email: 'l@example.com',
      qr_identifier: 'x1',
    },
  ],
  entitlements: [],
})
assert.equal(legacy[0]?.payment.status, 'unknown')
assert.equal(legacy[0]?.checkedIn, false)
assert.deepEqual(legacy[0]?.customFields, [])

const checkIn = read('electron/regfox/checkInAttendee.ts')
assert.equal(checkIn.includes('checkInAttendeeViaDesk'), true)
assert.equal(checkIn.includes('future update'), false)
assert.equal(
  read('src/features/attendees/AttendeeCheckInPanel.tsx').includes('Check In'),
  true,
)
assert.equal(
  read('src/features/attendees/AttendeeCheckInPanel.tsx').includes('checkInWriteEnabled'),
  false,
)

assert.equal(read('supabase/migrations/016_operational_attendee_snapshot.sql').includes('operational_json'), true)

console.log('test-operational-attendee-snapshot-parity: ok')
