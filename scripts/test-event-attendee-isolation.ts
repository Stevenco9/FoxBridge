import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  attendeeCacheBelongsToEvent,
  resolveAuthorizedEventId,
  selectAttendeesForAuthorizedEvent,
} from '../src/shared/attendees/eventAttendeeIsolation.ts'
import { mapCloudPublishedAttendeesToFoxBridge } from '../src/shared/attendees/mapCloudPublishedAttendees.ts'
import { INDIVIDUAL_MEAL_CATEGORY } from '../src/integrations/regfox/mealPurchaseClassification.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- Session vs persisted settings ---
assert.equal(
  resolveAuthorizedEventId({
    sessionEventId: 'event-b',
    persistedActiveEventId: 'event-a',
  }),
  'event-b',
  'session event wins over persisted activeEventId',
)
assert.equal(
  resolveAuthorizedEventId({
    sessionEventId: null,
    persistedActiveEventId: 'event-a',
  }),
  null,
  'persisted activeEventId cannot authorize attendees while locked/no session',
)

// --- Cache must not serve Event A while session is Event B ---
const eventAAttendees = [
  { id: 'a1', eventId: 'event-a', firstName: 'Ada' },
  { id: 'a2', eventId: 'event-a', firstName: 'Alan' },
]

assert.deepEqual(
  selectAttendeesForAuthorizedEvent({
    authorizedEventId: 'event-b',
    cacheEventId: 'event-a',
    cacheInitialized: true,
    cachedAttendees: eventAAttendees,
  }),
  [],
  'Event A cache must never be returned for Event B session',
)

assert.equal(
  attendeeCacheBelongsToEvent({
    cacheEventId: 'event-a',
    authorizedEventId: 'event-b',
    cacheInitialized: true,
  }),
  false,
)

assert.deepEqual(
  selectAttendeesForAuthorizedEvent({
    authorizedEventId: 'event-b',
    cacheEventId: 'event-b',
    cacheInitialized: true,
    cachedAttendees: [
      { id: 'b1', eventId: 'event-b', firstName: 'Bea' },
      { id: 'leak', eventId: 'event-a', firstName: 'Leak' },
    ],
  }),
  [{ id: 'b1', eventId: 'event-b', firstName: 'Bea' }],
  'even matching cacheEventId filters out foreign eventId rows',
)

assert.deepEqual(
  selectAttendeesForAuthorizedEvent({
    authorizedEventId: 'event-b',
    cacheEventId: null,
    cacheInitialized: false,
    cachedAttendees: eventAAttendees,
  }),
  [],
  'uninitialized / empty B snapshot → empty, not Event A',
)

// --- Cloud published → FoxBridge Attendee mapping (Linked hydration) ---
const mapped = mapCloudPublishedAttendeesToFoxBridge({
  foxbridgeEventId: 'event-b',
  attendees: [
    {
      attendee_id: 'reg-1',
      registration_id: 'reg-1',
      display_name: 'Test User',
      email: 'test@example.com',
      qr_identifier: 'reg-1',
    },
  ],
  entitlements: [
    {
      attendee_id: 'reg-1',
      meal_key: 'mealPan.fridayLunch',
      meal_label: 'Friday lunch',
    },
  ],
  syncedAt: '2026-08-12T00:00:00.000Z',
})

assert.equal(mapped.length, 1)
assert.equal(mapped[0]?.eventId, 'event-b')
assert.equal(mapped[0]?.firstName, 'Test')
assert.equal(mapped[0]?.lastName, 'User')
assert.equal(mapped[0]?.purchases[0]?.category, INDIVIDUAL_MEAL_CATEGORY)
assert.equal(mapped[0]?.purchases[0]?.id, 'mealPan.fridayLunch')

// Mapping for Event B must not accept empty foxbridgeEventId (no cross-store dump).
assert.deepEqual(
  mapCloudPublishedAttendeesToFoxBridge({
    foxbridgeEventId: '  ',
    attendees: [
      {
        attendee_id: 'reg-1',
        registration_id: 'reg-1',
        display_name: 'Nope',
        qr_identifier: 'reg-1',
      },
    ],
  }),
  [],
)

// --- Static wiring: fail-closed paths ---
const cache = read('electron/scannerServer/attendeeCache.ts')
assert.equal(cache.includes('cacheEventId'), true)
assert.equal(cache.includes('clearAttendeeCache'), true)
assert.equal(cache.includes('ensureAttendeeCacheForEvent'), true)
assert.equal(cache.includes('getEventAttendees(trimmed)'), true)

const store = read('electron/db/eventAttendeeRepository.ts')
assert.equal(
  store.includes('never a global cross-event snapshot'),
  true,
  'Local Event Store operational reads require event id',
)

const handlers = read('electron/regfoxHandlers.ts')
assert.equal(handlers.includes('resolveAuthorizedEventId'), true)
assert.equal(handlers.includes('hydrateAttendeesFromCloudForSession'), true)
assert.equal(handlers.includes("desk.role === 'linked'"), true)

const redeem = read('electron/settings/settingsService.ts')
assert.equal(redeem.includes('activateCloudConferenceEvent'), true)
assert.equal(redeem.includes('clearAttendeeCache'), true)
assert.equal(redeem.includes('hydrateAttendeesFromCloudForSession'), true)

const lifecycle = read('electron/session/eventAccessLifecycle.ts')
assert.equal(lifecycle.includes('clearAttendeeCache'), true)
assert.equal(lifecycle.includes('ensureAttendeeCacheForEvent'), true)

const edge = read('supabase/functions/desktop-pull-attendees/index.ts')
assert.equal(edge.includes('requireDeskDevice'), true)
assert.equal(edge.includes("eq('conference_id', conferenceId)"), true)
assert.equal(edge.includes('meal_entitlements'), true)

const rls = read('supabase/migrations/003_mobile_attendee_lookup.sql')
assert.equal(
  rls.includes('USING (true)'),
  true,
  'document existing broad anon read — do not broaden further',
)

console.log('test-event-attendee-isolation: ok')
