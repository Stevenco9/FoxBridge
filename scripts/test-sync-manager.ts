import assert from 'node:assert/strict'
import {
  CHECK_IN_SYNC_INTERVAL_MS,
  DESKTOP_SYNC_INTERVAL_MS,
  decideScheduledSyncStart,
} from '../electron/sync/syncManagerHelpers.ts'

assert.equal(DESKTOP_SYNC_INTERVAL_MS, 5 * 60 * 1000)
assert.ok(CHECK_IN_SYNC_INTERVAL_MS >= 10_000 && CHECK_IN_SYNC_INTERVAL_MS <= 15_000)

assert.equal(
  decideScheduledSyncStart({
    syncInProgress: false,
    activeEventId: 'event-1',
    cloudConfigured: true,
  }),
  'run',
)

assert.equal(
  decideScheduledSyncStart({
    syncInProgress: true,
    activeEventId: 'event-1',
    cloudConfigured: true,
  }),
  'skip_in_progress',
)

assert.equal(
  decideScheduledSyncStart({
    syncInProgress: false,
    activeEventId: null,
    cloudConfigured: true,
  }),
  'skip_no_active_event',
)

assert.equal(
  decideScheduledSyncStart({
    syncInProgress: false,
    activeEventId: '   ',
    cloudConfigured: true,
  }),
  'skip_no_active_event',
)

assert.equal(
  decideScheduledSyncStart({
    syncInProgress: false,
    activeEventId: 'event-1',
    cloudConfigured: false,
  }),
  'skip_cloud_unavailable',
)

// Overlap wins over missing Cloud (do not start a second concurrent run).
assert.equal(
  decideScheduledSyncStart({
    syncInProgress: true,
    activeEventId: null,
    cloudConfigured: false,
  }),
  'skip_in_progress',
)

assert.equal(
  decideScheduledSyncStart({
    syncInProgress: false,
    activeEventId: 'event-1',
    cloudConfigured: true,
    eventAccessUnlocked: false,
  }),
  'skip_event_locked',
)

console.log('test-sync-manager: ok')
