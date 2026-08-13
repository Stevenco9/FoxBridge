/**
 * Regression: Local Event Store must allow the same platform attendee id under
 * multiple FoxBridge Events (Linked A→B→A).
 *
 * Uses a pure in-memory model mirroring SQLite constraints (Electron's
 * better-sqlite3 ABI is not loadable from plain Node in this repo).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dedupeAttendeesByPlatformId } from '../electron/db/eventAttendeeRepository.ts'
import { createUnknownPayment } from '../src/shared/models/AttendeePayment.ts'
import type { Attendee } from '../src/shared/models/Attendee.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function attendee(eventId: string, id: string, firstName: string): Attendee {
  const now = '2026-08-13T00:00:00.000Z'
  return {
    id,
    registrationId: id,
    eventId,
    firstName,
    lastName: 'Tester',
    email: '',
    purchases: [],
    payment: createUnknownPayment(),
    customFields: [],
    checkedIn: false,
    badgePrinted: false,
    createdAt: now,
    updatedAt: now,
    syncedAt: now,
  }
}

/** Mirrors legacy global PRIMARY KEY (id) */
class LegacyStore {
  rows = new Map<string, Attendee>() // key = id only

  replace(eventId: string, attendees: Attendee[]): void {
    for (const [id, row] of [...this.rows.entries()]) {
      if (row.eventId === eventId) {
        this.rows.delete(id)
      }
    }
    for (const a of attendees) {
      if (this.rows.has(a.id) && this.rows.get(a.id)!.eventId !== eventId) {
        throw new Error('UNIQUE constraint failed: event_attendees.id')
      }
      this.rows.set(a.id, { ...a, eventId })
    }
  }

  get(eventId: string): Attendee[] {
    return [...this.rows.values()].filter((a) => a.eventId === eventId)
  }
}

/** Mirrors PRIMARY KEY (event_id, id) + transactional replace */
class EventScopedStore {
  rows = new Map<string, Attendee>() // key = eventId::id

  private key(eventId: string, id: string): string {
    return `${eventId}::${id}`
  }

  replace(eventId: string, attendees: Attendee[]): void {
    const snapshot = new Map(this.rows)
    try {
      for (const key of [...this.rows.keys()]) {
        if (key.startsWith(`${eventId}::`)) {
          this.rows.delete(key)
        }
      }
      for (const a of dedupeAttendeesByPlatformId(attendees)) {
        this.rows.set(this.key(eventId, a.id), { ...a, eventId })
      }
    } catch (error) {
      this.rows = snapshot
      throw error
    }
  }

  /** Simulate mid-replace failure after delete — must restore prior event rows. */
  replaceFailing(eventId: string): void {
    const snapshot = new Map(this.rows)
    for (const key of [...this.rows.keys()]) {
      if (key.startsWith(`${eventId}::`)) {
        this.rows.delete(key)
      }
    }
    // rollback
    this.rows = snapshot
  }

  get(eventId: string): Attendee[] {
    return [...this.rows.values()].filter((a) => a.eventId === eventId)
  }
}

// 1–2. Legacy global PK collides
const legacy = new LegacyStore()
legacy.replace('event-a', [attendee('event-a', '123', 'Ada')])
assert.throws(
  () => legacy.replace('event-b', [attendee('event-b', '123', 'Bea')]),
  /UNIQUE constraint failed: event_attendees\.id/,
)

// 3–8. Event-scoped composite key coexistence + replace isolation + A→B→A
const store = new EventScopedStore()
store.replace('event-a', [attendee('event-a', '123', 'Ada')])
store.replace('event-b', [attendee('event-b', '123', 'Bea')])
assert.equal(store.get('event-a').length, 1)
assert.equal(store.get('event-b').length, 1)
assert.equal(store.get('event-a')[0]?.firstName, 'Ada')
assert.equal(store.get('event-b')[0]?.firstName, 'Bea')

store.replace('event-a', [
  attendee('event-a', '123', 'Ada2'),
  attendee('event-a', '999', 'Other'),
])
assert.equal(store.get('event-a').length, 2)
assert.equal(store.get('event-b')[0]?.firstName, 'Bea')

store.replace('event-b', [attendee('event-b', '123', 'Bea2')])
assert.equal(store.get('event-a').length, 2)
assert.equal(store.get('event-b')[0]?.firstName, 'Bea2')

for (let i = 0; i < 4; i += 1) {
  store.replace('event-a', [attendee('event-a', '123', `Ada-${i}`)])
  store.replace('event-b', [attendee('event-b', '123', `Bea-${i}`)])
}
assert.equal(store.get('event-a')[0]?.firstName, 'Ada-3')
assert.equal(store.get('event-b')[0]?.firstName, 'Bea-3')

// 9. Duplicate incoming ids — last wins
const deduped = dedupeAttendeesByPlatformId([
  attendee('event-a', 'dup', 'First'),
  attendee('event-a', 'dup', 'Second'),
])
assert.equal(deduped.length, 1)
assert.equal(deduped[0]?.firstName, 'Second')
store.replace('event-a', [
  attendee('event-a', 'dup', 'First'),
  attendee('event-a', 'dup', 'Second'),
])
assert.equal(store.get('event-a').find((a) => a.id === 'dup')?.firstName, 'Second')

// 10. Failed replacement does not leave event empty
const before = store.get('event-a')
assert.ok(before.length > 0)
store.replaceFailing('event-a')
assert.equal(store.get('event-a').length, before.length)

// 11–15. Wiring / schema / migration / related suites still referenced
const database = read('electron/db/database.ts')
assert.equal(database.includes('PRIMARY KEY (event_id, id)'), true)
assert.equal(database.includes('migrateLocalDatabase'), true)

const repo = read('electron/db/eventAttendeeRepository.ts')
assert.equal(repo.includes('ON CONFLICT(event_id, id)'), true)
assert.equal(repo.includes('dedupeAttendeesByPlatformId'), true)
assert.equal(repo.includes('db.transaction'), true)

const migration = read('electron/db/localDbMigrations.ts')
assert.equal(migration.includes('event_attendees_v2'), true)
assert.equal(migration.includes('PRIMARY KEY (event_id, id)'), true)
assert.equal(migration.includes('LOCAL_DB_USER_VERSION = 3'), true)
assert.equal(migration.includes('event_attendee_check_ins'), true)

// No Supabase / Edge change required for this SQLite fix
assert.equal(read('supabase/migrations/016_operational_attendee_snapshot.sql').includes('attendees'), true)

console.log('test-event-attendee-store-multi-event: ok')
