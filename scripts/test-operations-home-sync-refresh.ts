import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildOperationsHomeRefreshToken,
  resolveFoxBridgeSyncHomeStatus,
  shouldShowConnectedDesksAction,
} from '../src/shared/sync/foxbridgeSyncStatus.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// Simulate Operations Home before claim (legacy connected).
const beforeClaim = {
  foxbridgeSyncConnected: true,
  foxbridgeSyncEnrolled: true,
  foxbridgeSyncDeskRole: 'legacy' as const,
  foxbridgeSyncConnectionError: null,
}
assert.equal(
  resolveFoxBridgeSyncHomeStatus({
    connected: beforeClaim.foxbridgeSyncConnected,
    enrolled: beforeClaim.foxbridgeSyncEnrolled,
    deskRole: beforeClaim.foxbridgeSyncDeskRole,
    connectionError: beforeClaim.foxbridgeSyncConnectionError,
  }),
  'connected_legacy',
)
assert.equal(shouldShowConnectedDesksAction(beforeClaim), false)

// After successful claim, parent re-reads SetupStatus (no restart) → Principal.
const afterClaim = {
  foxbridgeSyncConnected: true,
  foxbridgeSyncEnrolled: true,
  foxbridgeSyncDeskRole: 'principal' as const,
  foxbridgeSyncConnectionError: null,
}
assert.equal(
  resolveFoxBridgeSyncHomeStatus({
    connected: afterClaim.foxbridgeSyncConnected,
    enrolled: afterClaim.foxbridgeSyncEnrolled,
    deskRole: afterClaim.foxbridgeSyncDeskRole,
    connectionError: afterClaim.foxbridgeSyncConnectionError,
  }),
  'connected_principal',
)
assert.equal(shouldShowConnectedDesksAction(afterClaim), true)

// Linked redemption / reconnect also must not expose Connected Desktops.
assert.equal(
  shouldShowConnectedDesksAction({
    foxbridgeSyncConnected: true,
    foxbridgeSyncDeskRole: 'linked',
  }),
  false,
)

// Sync credential epoch bump must change Operations Home refresh token
// (attendee count alone is not enough after legacy → Principal claim).
const beforeToken = buildOperationsHomeRefreshToken({
  attendeeCount: 42,
  syncCredentialEpoch: 0,
})
const afterToken = buildOperationsHomeRefreshToken({
  attendeeCount: 42,
  syncCredentialEpoch: 1,
})
assert.notEqual(beforeToken, afterToken)
assert.equal(
  buildOperationsHomeRefreshToken({ attendeeCount: 42, syncCredentialEpoch: 0 }),
  beforeToken,
)

// Parent wiring: Sync onChanged bumps connectRefreshToken into OperationsHome.
const attendeeSearch = readFileSync(
  join(root, 'src/features/attendees/AttendeeSearchScreen.tsx'),
  'utf8',
)
assert.ok(attendeeSearch.includes('buildOperationsHomeRefreshToken'))
assert.ok(attendeeSearch.includes('syncCredentialEpoch: connectRefreshToken'))
assert.ok(attendeeSearch.includes('setConnectRefreshToken'))
assert.ok(
  /ConnectFoxBridgeSyncPanel[\s\S]*onChanged=\{\(\) => \{[\s\S]*refreshMeta\(\)[\s\S]*setConnectRefreshToken/.test(
    attendeeSearch,
  ),
)

const operationsHome = readFileSync(
  join(root, 'src/features/operations/OperationsHome.tsx'),
  'utf8',
)
assert.ok(operationsHome.includes('shouldShowConnectedDesksAction'))
assert.ok(operationsHome.includes('[refreshStatus, refreshToken]'))

console.log('test-operations-home-sync-refresh: ok')
