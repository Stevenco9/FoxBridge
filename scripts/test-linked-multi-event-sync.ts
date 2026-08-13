import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildAttendeeHydrateDiagnostics,
  shouldPullCloudAttendeeSnapshot,
} from '../src/shared/attendees/cloudAttendeeSnapshotSync.ts'
import { mapCloudPublishedAttendeesToFoxBridge } from '../src/shared/attendees/mapCloudPublishedAttendees.ts'
import {
  selectAttendeesForAuthorizedEvent,
} from '../src/shared/attendees/eventAttendeeIsolation.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- Snapshot revision / near-real-time pull decision ---
assert.equal(
  shouldPullCloudAttendeeSnapshot({
    localCursorTimestamp: null,
    cloudLastDesktopSyncAt: '2026-08-13T04:25:46.908Z',
  }),
  true,
  'first unlock must pull when Cloud has a published snapshot',
)

assert.equal(
  shouldPullCloudAttendeeSnapshot({
    localCursorTimestamp: '2026-08-13T04:25:46.908Z',
    cloudLastDesktopSyncAt: '2026-08-13T04:25:46.908Z',
  }),
  false,
  'matching revision skips redundant full download',
)

assert.equal(
  shouldPullCloudAttendeeSnapshot({
    localCursorTimestamp: '2026-08-13T04:19:41.411Z',
    cloudLastDesktopSyncAt: '2026-08-13T04:25:46.908Z',
  }),
  true,
  'newer Principal publish must pull',
)

assert.equal(
  shouldPullCloudAttendeeSnapshot({
    localCursorTimestamp: '2026-08-13T04:25:46.908Z',
    cloudLastDesktopSyncAt: '2026-08-13T04:25:46.908Z',
    force: true,
  }),
  true,
  'manual refresh / join forces pull',
)

assert.equal(
  shouldPullCloudAttendeeSnapshot({
    localCursorTimestamp: null,
    cloudLastDesktopSyncAt: null,
  }),
  true,
  'no cursor and no Cloud timestamp still attempts one pull',
)

assert.equal(
  shouldPullCloudAttendeeSnapshot({
    localCursorTimestamp: '2026-08-13T04:25:46.908Z',
    cloudLastDesktopSyncAt: null,
  }),
  false,
  'do not thrash-pull when Cloud has never published but local already synced',
)

// --- Multi-event fixture mapping (269-equivalent A / 10-equivalent B) ---
function fixtureAttendees(eventId: string, count: number, prefix: string) {
  return Array.from({ length: count }, (_, i) => ({
    attendee_id: `${prefix}-${i + 1}`,
    registration_id: `${prefix}-reg-${i + 1}`,
    display_name: `${prefix} Person ${i + 1}`,
    email: null,
    qr_identifier: `${prefix}-qr-${i + 1}`,
    updated_at: '2026-08-13T00:00:00.000Z',
  }))
}

function fixtureEntitlements(prefix: string, attendeeCount: number, mealsPer = 2) {
  const rows = []
  for (let i = 1; i <= attendeeCount; i += 1) {
    for (let m = 1; m <= mealsPer; m += 1) {
      rows.push({
        attendee_id: `${prefix}-${i}`,
        meal_key: `meal.${m}`,
        meal_label: `Meal ${m}`,
        source: 'individual',
        source_plan_id: null,
      })
    }
  }
  return rows
}

const localEventA = 'fox-event-a-uuid'
const localEventB = 'fox-event-b-uuid'
const conferenceA = 'd00f67ca-2d5b-4e3e-b7bb-659bc0031363'
const conferenceB = 'ec447c9f-6482-4a5b-8375-824a3f62c3ea'

const mappedA = mapCloudPublishedAttendeesToFoxBridge({
  foxbridgeEventId: localEventA,
  attendees: fixtureAttendees(localEventA, 269, 'a'),
  entitlements: fixtureEntitlements('a', 269),
})
const mappedB = mapCloudPublishedAttendeesToFoxBridge({
  foxbridgeEventId: localEventB,
  attendees: fixtureAttendees(localEventB, 10, 'b'),
  entitlements: fixtureEntitlements('b', 10),
})

assert.equal(mappedA.length, 269)
assert.equal(mappedB.length, 10)
assert.ok(mappedA.every((row) => row.eventId === localEventA))
assert.ok(mappedB.every((row) => row.eventId === localEventB))
assert.equal(mappedA[0]?.purchases.length, 2)
assert.equal(mappedB[0]?.purchases.length, 2)

// Simulate A → B → A cycle: each session only sees its own snapshot.
const cycles: Array<{ session: string; cache: typeof mappedA }> = [
  { session: localEventA, cache: mappedA },
  { session: localEventB, cache: mappedB },
  { session: localEventA, cache: mappedA },
  { session: localEventB, cache: mappedB },
  { session: localEventA, cache: mappedA },
]

for (const step of cycles) {
  const visible = selectAttendeesForAuthorizedEvent({
    authorizedEventId: step.session,
    cacheEventId: step.session,
    cacheInitialized: true,
    cachedAttendees: step.cache,
  })
  assert.equal(visible.length, step.cache.length)
  assert.ok(visible.every((row) => row.eventId === step.session))
}

// Cross-event leak must stay empty even if wrong cache is still warm.
assert.deepEqual(
  selectAttendeesForAuthorizedEvent({
    authorizedEventId: localEventA,
    cacheEventId: localEventB,
    cacheInitialized: true,
    cachedAttendees: mappedB,
  }),
  [],
)

assert.deepEqual(
  selectAttendeesForAuthorizedEvent({
    authorizedEventId: localEventB,
    cacheEventId: localEventA,
    cacheInitialized: true,
    cachedAttendees: mappedA,
  }),
  [],
)

// Desk conference must match pull conference in diagnostics identity.
const diag = buildAttendeeHydrateDiagnostics({
  sessionEventId: localEventA,
  deskConferenceId: conferenceA,
  pullConferenceId: conferenceA,
  cacheEventId: localEventA,
  pullAttendeeCount: 269,
  pullEntitlementCount: 2018,
  mappedAttendeeCount: 269,
  localStoredAttendeeCount: 269,
  lastDesktopSyncAt: '2026-08-13T04:25:46.908Z',
  success: true,
})
assert.equal(diag.deskConferenceId, conferenceA)
assert.equal(diag.pullConferenceId, conferenceA)
assert.equal(diag.pullAttendeeCount, 269)
assert.equal(diag.success, true)
assert.equal(diag.message, null)

// Mismatch must be visible in diagnostics (never silent cross-event apply).
const bad = buildAttendeeHydrateDiagnostics({
  sessionEventId: localEventA,
  deskConferenceId: conferenceA,
  pullConferenceId: conferenceB,
  cacheEventId: localEventA,
  pullAttendeeCount: 10,
  pullEntitlementCount: 42,
  mappedAttendeeCount: 0,
  success: false,
  message: 'Cloud returned attendees for a different event.',
})
assert.equal(bad.success, false)
assert.notEqual(bad.deskConferenceId, bad.pullConferenceId)

// --- Wiring: Linked refresh is Cloud hydrate; resolve no longer writes regfox_event_id ---
const settingsService = read('electron/settings/settingsService.ts')
assert.equal(settingsService.includes("desk?.role === 'linked'"), true)
assert.equal(settingsService.includes('hydrateAttendeesFromCloudForSession'), true)
assert.equal(settingsService.includes('regfoxEventId: null'), true)
assert.equal(settingsService.includes('lastMobilePublishWarning: null'), true)

const resolveEdge = read('supabase/functions/desktop-resolve-conference/index.ts')
assert.equal(
  resolveEdge.includes('.update({'),
  false,
  'desktop-resolve-conference must not update conference identity columns',
)

const pullEdge = read('supabase/functions/desktop-pull-attendees/index.ts')
assert.equal(pullEdge.includes('PAGE_SIZE'), true)
assert.equal(pullEdge.includes('.range('), true)

const syncService = read('electron/sync/syncService.ts')
assert.equal(syncService.includes('attendeeSnapshotSyncHandler'), true)

const syncTypes = read('electron/sync/syncTypes.ts')
assert.equal(syncTypes.includes("'attendee_snapshot'"), true)

const conferenceRepo = read('electron/cloud/conferenceRepository.ts')
assert.equal(
  conferenceRepo.includes("desk.role === 'linked' ? null : settings.regfoxEventId"),
  true,
)

const hydrate = read('electron/cloud/hydrateAttendeesFromCloud.ts')
assert.equal(hydrate.includes('[attendee-hydrate]'), true)
assert.equal(hydrate.includes('attendee_snapshot'), true)

console.log('test-linked-multi-event-sync: ok')
