import assert from 'node:assert/strict'
import {
  advanceSyncCursor,
  isRowAfterSyncCursor,
  resolveLocalAttendeeIdForSync,
} from '../electron/sync/syncHelpers.ts'

assert.equal(
  resolveLocalAttendeeIdForSync('qr-1', [
    { id: 'local-1', qrIdentifier: 'qr-1' },
    { id: 'local-2', qrIdentifier: 'qr-2' },
  ]),
  'local-1',
)

assert.equal(
  resolveLocalAttendeeIdForSync('local-2', [
    { id: 'local-1', qrIdentifier: 'qr-1' },
    { id: 'local-2', qrIdentifier: 'qr-2' },
  ]),
  'local-2',
)

assert.equal(
  resolveLocalAttendeeIdForSync('unknown', [{ id: 'local-1', qrIdentifier: 'qr-1' }]),
  'unknown',
)

const emptyCursor = { lastTimestamp: null, lastId: null }
assert.equal(
  isRowAfterSyncCursor({ id: 'a', validatedAt: '2026-01-01T00:00:00.000Z' }, emptyCursor),
  true,
)

const cursor = {
  lastTimestamp: '2026-01-01T00:00:00.000Z',
  lastId: 'b',
}
assert.equal(
  isRowAfterSyncCursor({ id: 'a', validatedAt: '2026-01-01T00:00:00.000Z' }, cursor),
  false,
)
assert.equal(
  isRowAfterSyncCursor({ id: 'c', validatedAt: '2026-01-01T00:00:00.000Z' }, cursor),
  true,
)
assert.equal(
  isRowAfterSyncCursor({ id: 'z', validatedAt: '2026-01-02T00:00:00.000Z' }, cursor),
  true,
)

const advanced = advanceSyncCursor(cursor, [
  { id: 'c', validatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'd', validatedAt: '2026-01-03T00:00:00.000Z' },
])
assert.deepEqual(advanced, {
  lastTimestamp: '2026-01-03T00:00:00.000Z',
  lastId: 'd',
})

console.log('test-desktop-sync: ok')
