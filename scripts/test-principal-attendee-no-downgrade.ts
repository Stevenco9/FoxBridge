import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shouldReplaceLocalAttendeesFromCloudSnapshot } from '../src/shared/attendees/cloudAttendeeSnapshotAuthority.ts'
import { mapCloudPublishedAttendeesToFoxBridge } from '../src/shared/attendees/mapCloudPublishedAttendees.ts'
import { createUnknownPayment } from '../src/shared/models/AttendeePayment.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- Role gate: Principal / RegFox never Cloud-replace ---
assert.equal(
  shouldReplaceLocalAttendeesFromCloudSnapshot({
    deskRole: 'principal',
    unlockMethod: 'principal',
    hasRegFoxRegistrationAuthority: true,
  }),
  false,
)

assert.equal(
  shouldReplaceLocalAttendeesFromCloudSnapshot({
    deskRole: 'principal',
    unlockMethod: 'principal',
    hasRegFoxRegistrationAuthority: false,
  }),
  false,
)

assert.equal(
  shouldReplaceLocalAttendeesFromCloudSnapshot({
    deskRole: 'linked',
    unlockMethod: 'linked',
  }),
  true,
)

assert.equal(
  shouldReplaceLocalAttendeesFromCloudSnapshot({
    deskRole: 'legacy',
    unlockMethod: 'legacy',
    hasRegFoxRegistrationAuthority: true,
  }),
  false,
  'legacy with RegFox authority must not Cloud-downgrade',
)

assert.equal(
  shouldReplaceLocalAttendeesFromCloudSnapshot({
    deskRole: 'legacy',
    unlockMethod: 'legacy',
    hasRegFoxRegistrationAuthority: false,
  }),
  true,
  'Cloud-only legacy may hydrate from snapshot',
)

assert.equal(
  shouldReplaceLocalAttendeesFromCloudSnapshot({
    deskRole: 'linked',
    unlockMethod: 'regfox',
    hasRegFoxRegistrationAuthority: true,
  }),
  false,
  'unlockMethod principal/regfox wins over desk role',
)

assert.equal(
  shouldReplaceLocalAttendeesFromCloudSnapshot({
    deskRole: null,
    unlockMethod: null,
  }),
  false,
  'unknown role fail-closed',
)

// --- Rich Principal record must not equal Cloud projection ---
const richPrincipal = {
  id: 'a1',
  registrationId: 'reg-1',
  confirmationCode: 'CONF-1',
  eventId: 'event-principal',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  organization: 'Analytical Engines',
  purchases: [
    { id: 'ticket.full', name: 'Full ticket', quantity: 1, category: 'ticket' },
    { id: 'mealPan.fridayLunch', name: 'Friday lunch', quantity: 1, category: 'individualMeal' },
  ],
  payment: {
    status: 'paid' as const,
    totalAmount: 120,
    amountPaid: 120,
    balanceDue: 0,
    currency: 'USD',
    upstreamStatus: 'complete',
    source: 'regfox' as const,
  },
  customFields: [{ key: 'city', label: 'City', value: 'London' }],
  checkedIn: true,
  checkedInAt: '2026-08-12T15:00:00.000Z',
  badgePrinted: true,
  badgePrintedAt: '2026-08-12T15:05:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-12T15:00:00.000Z',
  syncedAt: '2026-08-12T14:00:00.000Z',
}

const cloudProjection = mapCloudPublishedAttendeesToFoxBridge({
  foxbridgeEventId: 'event-principal',
  attendees: [
    {
      attendee_id: 'a1',
      registration_id: 'reg-1',
      display_name: 'Ada Lovelace',
      email: 'ada@example.com',
      qr_identifier: 'CONF-1',
      updated_at: '2026-08-13T00:00:00.000Z',
    },
  ],
  entitlements: [
    {
      attendee_id: 'CONF-1',
      meal_key: 'mealPan.fridayLunch',
      meal_label: 'Friday lunch',
      source: 'individual',
      source_plan_id: null,
    },
  ],
})

assert.equal(cloudProjection.length, 1)
const projected = cloudProjection[0]!
assert.equal(projected.payment.status, 'unknown')
assert.equal(projected.checkedIn, false)
assert.deepEqual(projected.customFields, [])
assert.equal(projected.organization, undefined)
assert.notEqual(projected.payment.status, richPrincipal.payment.status)
assert.notEqual(projected.checkedIn, richPrincipal.checkedIn)
assert.ok(projected.purchases.every((p) => p.id.startsWith('mealPan.') || p.id.startsWith('meal.')))
assert.ok(richPrincipal.purchases.some((p) => p.id === 'ticket.full'))

// Simulate: after publish, sync must NOT replace Principal rich with projection.
const wouldReplace = shouldReplaceLocalAttendeesFromCloudSnapshot({
  deskRole: 'principal',
  unlockMethod: 'principal',
  hasRegFoxRegistrationAuthority: true,
})
assert.equal(wouldReplace, false)
const retained = wouldReplace ? projected : richPrincipal
assert.equal(retained.payment.status, 'paid')
assert.equal(retained.checkedIn, true)
assert.equal(retained.customFields.length, 1)
assert.equal(retained.organization, 'Analytical Engines')
assert.ok(retained.purchases.some((p) => p.id === 'ticket.full'))

// Linked still allowed to take Cloud projection
assert.equal(
  shouldReplaceLocalAttendeesFromCloudSnapshot({
    deskRole: 'linked',
    unlockMethod: 'linked',
    hasRegFoxRegistrationAuthority: false,
  }),
  true,
)
const linkedLocal = mapCloudPublishedAttendeesToFoxBridge({
  foxbridgeEventId: 'event-linked',
  attendees: [
    {
      attendee_id: 'a1',
      registration_id: 'reg-1',
      display_name: 'Ada Lovelace',
      email: 'ada@example.com',
      qr_identifier: 'CONF-1',
    },
  ],
  entitlements: [],
})
assert.equal(linkedLocal[0]?.payment.status, createUnknownPayment().status)

// --- Wiring: gates present at sync, hydrate, getAttendees ---
const syncEntity = read('electron/sync/entities/attendeeSnapshotSync.ts')
assert.equal(syncEntity.includes('mayReplaceLocalAttendeesFromCloudSnapshot'), true)
assert.equal(syncEntity.includes('skipped_role_gate'), true)

const hydrate = read('electron/cloud/hydrateAttendeesFromCloud.ts')
assert.equal(hydrate.includes('mayReplaceLocalAttendeesFromCloudSnapshot'), true)
assert.equal(hydrate.includes('skippedByRoleGate'), true)

const handlers = read('electron/regfoxHandlers.ts')
assert.equal(handlers.includes('mayReplaceLocalAttendeesFromCloudSnapshot'), true)
assert.ok(
  handlers.indexOf('mayReplaceLocalAttendeesFromCloudSnapshot') <
    handlers.indexOf('hydrateAttendeesFromCloudForSession'),
  'getAttendees must role-gate before Cloud hydrate',
)

const updateRegs = read('electron/settings/settingsService.ts')
assert.equal(updateRegs.includes("desk?.role === 'linked'"), true)
assert.equal(updateRegs.includes('loadRegFoxAttendees'), true)

console.log('test-principal-attendee-no-downgrade: ok')
