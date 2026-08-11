import assert from 'node:assert/strict'
import type { Event } from '../src/shared/models/Event.ts'

/**
 * Sprint 21.3 — Event identity foundation (pure, no Electron / native SQLite).
 */

function resolveLocalEventStoreKey(settings: {
  activeEventId: string | null
  regfoxEventId: string | null
}): string | null {
  return settings.activeEventId?.trim() || settings.regfoxEventId?.trim() || null
}

const foxEvent: Event = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  name: 'AdAgrA 2026',
  registrationPlatform: 'regfox',
  platformEventId: 'page-99',
  createdAt: '2026-08-01T00:00:00.000Z',
  lastSyncedAt: '2026-08-10T00:00:00.000Z',
}

// Platform-independent Event is distinct from RegFox page id.
assert.notEqual(foxEvent.id, foxEvent.platformEventId)
assert.equal(foxEvent.registrationPlatform, 'regfox')
assert.equal(foxEvent.platformEventId, 'page-99')
assert.ok(foxEvent.createdAt)
assert.ok(foxEvent.lastSyncedAt)

// Round-trip JSON stays serializable for IPC / persistence payloads.
const roundTrip = JSON.parse(JSON.stringify(foxEvent)) as Event
assert.deepEqual(roundTrip, foxEvent)

// New code prefers FoxBridge Event id; RegFox id remains as fallback.
assert.equal(
  resolveLocalEventStoreKey({
    activeEventId: foxEvent.id,
    regfoxEventId: foxEvent.platformEventId,
  }),
  foxEvent.id,
)

assert.equal(
  resolveLocalEventStoreKey({
    activeEventId: null,
    regfoxEventId: foxEvent.platformEventId,
  }),
  'page-99',
)

assert.equal(
  resolveLocalEventStoreKey({
    activeEventId: '  ',
    regfoxEventId: ' page-99 ',
  }),
  'page-99',
)

assert.equal(
  resolveLocalEventStoreKey({
    activeEventId: null,
    regfoxEventId: null,
  }),
  null,
)

// Dual-key Event Settings resolve order: FoxBridge id first, then platform alias.
function resolveSettingsKeys(input: {
  requestedKey: string
  foxbridgeEventId: string
  platformEventId: string
}): string[] {
  const keys = [input.requestedKey]
  if (input.requestedKey === input.foxbridgeEventId) {
    keys.push(input.platformEventId)
  } else if (input.requestedKey === input.platformEventId) {
    keys.unshift(input.foxbridgeEventId)
  }
  return [...new Set(keys)]
}

assert.deepEqual(
  resolveSettingsKeys({
    requestedKey: foxEvent.id,
    foxbridgeEventId: foxEvent.id,
    platformEventId: foxEvent.platformEventId,
  }),
  [foxEvent.id, 'page-99'],
)

assert.deepEqual(
  resolveSettingsKeys({
    requestedKey: 'page-99',
    foxbridgeEventId: foxEvent.id,
    platformEventId: foxEvent.platformEventId,
  }),
  [foxEvent.id, 'page-99'],
)

// Sync cursor association nests under FoxBridge Event when known.
const cursorFile = {
  version: 2 as const,
  conferences: {
    'conf-1': {
      meal_validations: { lastTimestamp: 't0', lastId: 'id0' },
    },
  },
  events: {
    [foxEvent.id]: {
      conferences: {
        'conf-1': {
          meal_validations: { lastTimestamp: 't1', lastId: 'id1' },
        },
      },
    },
  },
}

function readCursor(
  file: typeof cursorFile,
  conferenceId: string,
  foxbridgeEventId?: string | null,
) {
  const eventId = foxbridgeEventId?.trim()
  if (eventId) {
    const fromEvent = file.events[eventId]?.conferences?.[conferenceId]?.meal_validations
    if (fromEvent) return fromEvent
  }
  return file.conferences[conferenceId]?.meal_validations ?? null
}

assert.deepEqual(readCursor(cursorFile, 'conf-1', foxEvent.id), {
  lastTimestamp: 't1',
  lastId: 'id1',
})
assert.deepEqual(readCursor(cursorFile, 'conf-1', null), {
  lastTimestamp: 't0',
  lastId: 'id0',
})

console.log('test-event-identity: ok')
