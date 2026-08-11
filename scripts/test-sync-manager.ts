import assert from 'node:assert/strict'
import {
  DESKTOP_SYNC_INTERVAL_MS,
  decideScheduledSyncStart,
} from '../electron/sync/syncManagerHelpers.ts'

assert.equal(DESKTOP_SYNC_INTERVAL_MS, 5 * 60 * 1000)

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

console.log('test-sync-manager: ok')
