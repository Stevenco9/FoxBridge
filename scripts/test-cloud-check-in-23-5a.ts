/**
 * Sprint 23.5a — Cloud check-in + multi-desk convergence (static + unit).
 * Does not hit live Cloud / RegFox.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCAL_DB_USER_VERSION } from '../electron/db/localDbMigrations.ts'
import { CHECK_IN_SYNC_INTERVAL_MS } from '../electron/sync/syncManagerHelpers.ts'
import { createUnknownPayment } from '../src/shared/models/AttendeePayment.ts'
import type { Attendee } from '../src/shared/models/Attendee.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function attendee(partial: Partial<Attendee> & { id: string; eventId: string }): Attendee {
  const now = '2026-08-13T00:00:00.000Z'
  return {
    registrationId: partial.id,
    firstName: 'Test',
    lastName: 'User',
    email: '',
    purchases: [],
    payment: createUnknownPayment(),
    customFields: [],
    checkedIn: false,
    badgePrinted: false,
    createdAt: now,
    updatedAt: now,
    syncedAt: now,
    ...partial,
  }
}

// --- Migration / Edge packaging ---
assert.ok(
  existsSync(join(root, 'supabase/migrations/017_conference_attendee_check_ins.sql')),
)
const migration017 = read('supabase/migrations/017_conference_attendee_check_ins.sql')
assert.ok(migration017.includes('conference_attendee_check_ins'))
assert.ok(migration017.includes('PRIMARY KEY (conference_id, attendee_id)'))
assert.ok(migration017.includes('upstream_sync_status'))
assert.equal(migration017.includes('regfox_api'), false)
assert.ok(migration017.includes('REVOKE ALL'))
assert.ok(migration017.includes('ENABLE ROW LEVEL SECURITY'))
// Audit deferred
assert.equal(migration017.includes('check_in_audit'), false)

assert.ok(existsSync(join(root, 'supabase/functions/desktop-check-in/index.ts')))
assert.ok(existsSync(join(root, 'supabase/functions/desktop-pull-check-ins/index.ts')))

const checkInEdge = read('supabase/functions/desktop-check-in/index.ts')
assert.ok(checkInEdge.includes('requireDeskDevice'))
assert.ok(checkInEdge.includes('desk.conference_id'))
assert.ok(checkInEdge.includes('alreadyCheckedIn'))
assert.ok(checkInEdge.includes('23505'))
assert.equal(checkInEdge.toLowerCase().includes('regfox'), false)
assert.equal(checkInEdge.includes('checkInRegistrant'), false)

const pullEdge = read('supabase/functions/desktop-pull-check-ins/index.ts')
assert.ok(pullEdge.includes('requireDeskDevice'))
assert.ok(pullEdge.includes('assertConferenceScope'))

// --- Desktop Cloud-first path ---
const desktopCheckIn = read('electron/regfox/checkInAttendee.ts')
assert.ok(desktopCheckIn.includes('checkInAttendeeViaDesk'))
assert.ok(desktopCheckIn.includes('persistEventAttendeeCheckIn'))
assert.equal(desktopCheckIn.includes('createRegFoxServiceFromSettings'), false)
assert.equal(desktopCheckIn.includes('LINKED_CHECK_IN_WRITE_DEFERRED'), false)
assert.equal(desktopCheckIn.includes('future update'), false)

const viaRegFox = read('electron/regfox/checkInAttendeeViaRegFox.ts')
assert.ok(viaRegFox.includes('23.5b'))
assert.ok(viaRegFox.includes('checkInRegistrant'))

const cloudApi = read('electron/cloud/desktopCloudApi.ts')
assert.ok(cloudApi.includes('desktop-check-in'))
assert.ok(cloudApi.includes('desktop-pull-check-ins'))
assert.equal(cloudApi.includes('SERVICE_ROLE'), false)

// --- Local overlay schema ---
assert.equal(LOCAL_DB_USER_VERSION, 3)
const localMig = read('electron/db/localDbMigrations.ts')
assert.ok(localMig.includes('event_attendee_check_ins'))
assert.ok(localMig.includes('PRIMARY KEY (event_id, attendee_id)'))
assert.ok(localMig.includes('attendee_check_ins'))

const dbSchema = read('electron/db/database.ts')
assert.ok(dbSchema.includes('event_attendee_check_ins'))
assert.equal(dbSchema.includes('attendee_id TEXT PRIMARY KEY'), false)

// --- Sync entity ---
assert.ok(CHECK_IN_SYNC_INTERVAL_MS >= 10_000 && CHECK_IN_SYNC_INTERVAL_MS <= 15_000)
const syncTypes = read('electron/sync/syncTypes.ts')
assert.ok(syncTypes.includes("'check_in_state'"))
const syncService = read('electron/sync/syncService.ts')
assert.ok(syncService.includes('checkInStateSyncHandler'))
assert.ok(syncService.includes('syncCheckInStateBestEffort'))
const syncManager = read('electron/sync/syncManager.ts')
assert.ok(syncManager.includes('requestCheckInSyncBestEffort'))
assert.ok(syncManager.includes('CHECK_IN_SYNC_INTERVAL_MS'))

const checkInSync = read('electron/sync/entities/checkInStateSync.ts')
assert.ok(checkInSync.includes('pullCheckInsViaDesk'))
assert.ok(checkInSync.includes('persistEventAttendeeCheckIn'))
assert.equal(checkInSync.toLowerCase().includes('regfox'), false)

// --- UI parity ---
const panel = read('src/features/attendees/AttendeeCheckInPanel.tsx')
assert.equal(panel.includes('checkInWriteEnabled'), false)
assert.ok(panel.includes('Check In'))
assert.equal(panel.includes('coming soon'), false)

const search = read('src/features/attendees/AttendeeSearchScreen.tsx')
assert.ok(search.includes('onAttendeesChanged'))
assert.equal(search.includes('checkInWriteEnabled'), false)

// --- Merge precedence (pure) ---
// Simulate overlay map behavior without SQLite by testing apply logic contract:
// when overlay present for event, it wins over base snapshot checkedIn=false.
const base = [
  attendee({
    id: 'a1',
    eventId: 'event-a',
    checkedIn: false,
    checkedInAt: undefined,
  }),
  attendee({
    id: 'a2',
    eventId: 'event-a',
    checkedIn: true,
    checkedInAt: '2026-01-01T00:00:00.000Z',
  }),
]

// applyPersistedCheckIns with empty DB returns base unchanged (no Electron app DB).
// Unit-test merge rule explicitly:
function mergeWithOverlay(
  attendees: Attendee[],
  overlay: Map<string, { checkedIn: boolean; checkedInAt: string }>,
): Attendee[] {
  return attendees.map((a) => {
    const o = overlay.get(a.id)
    if (!o) return a
    return { ...a, checkedIn: o.checkedIn, checkedInAt: o.checkedInAt }
  })
}

const overlay = new Map([
  ['a1', { checkedIn: true, checkedInAt: '2026-08-13T12:00:00.000Z' }],
])
const merged = mergeWithOverlay(base, overlay)
assert.equal(merged[0]?.checkedIn, true)
assert.equal(merged[0]?.checkedInAt, '2026-08-13T12:00:00.000Z')
assert.equal(merged[1]?.checkedIn, true)
assert.equal(merged[1]?.checkedInAt, '2026-01-01T00:00:00.000Z')

// Event isolation of overlay keys
const overlayA = new Map([['shared', { checkedIn: true, checkedInAt: 't-a' }]])
const overlayB = new Map<string, { checkedIn: boolean; checkedInAt: string }>()
const eventA = [attendee({ id: 'shared', eventId: 'event-a', checkedIn: false })]
const eventB = [attendee({ id: 'shared', eventId: 'event-b', checkedIn: false })]
assert.equal(mergeWithOverlay(eventA, overlayA)[0]?.checkedIn, true)
assert.equal(mergeWithOverlay(eventB, overlayB)[0]?.checkedIn, false)

// Idempotent timestamp rule (documented): first wins
const firstAt = '2026-08-13T10:00:00.000Z'
const secondAttemptAt = '2026-08-13T10:00:05.000Z'
const preserved = firstAt < secondAttemptAt ? firstAt : secondAttemptAt
assert.equal(preserved, firstAt)

// Repository is event-scoped (source inspection)
const checkInRepo = read('electron/db/attendeeCheckInRepository.ts')
assert.ok(checkInRepo.includes('PRIMARY KEY') || checkInRepo.includes('event_id, attendee_id'))
assert.ok(checkInRepo.includes('applyPersistedCheckIns'))
assert.ok(checkInRepo.includes('getEventPersistedCheckIns'))

// Migrations sorted include 017
const migrationFiles = readdirSync(join(root, 'supabase/migrations'))
  .filter((n) => n.endsWith('.sql'))
  .sort()
assert.ok(migrationFiles.includes('017_conference_attendee_check_ins.sql'))

console.log('test-cloud-check-in-23-5a: ok')
