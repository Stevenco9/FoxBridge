import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertNoRegFoxApiKeyInObject,
  classifyFoxBridgeSyncIssue,
  foxBridgeSyncIssueFallbackMessage,
  resolveFoxBridgeSyncHomeStatus,
  resolveFoxBridgeSyncPhase,
} from '../src/shared/sync/foxbridgeSyncStatus.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: false,
    needsTransferConfirmation: false,
    deskCredentialConfigured: false,
    connected: false,
    connectionError: null,
    enrollError: null,
  }),
  'ready_to_setup',
)

assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: true,
    codeEntryVisible: false,
    needsTransferConfirmation: false,
    deskCredentialConfigured: false,
    connected: false,
    connectionError: null,
    enrollError: null,
  }),
  'connecting',
)

assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: false,
    needsTransferConfirmation: false,
    deskCredentialConfigured: true,
    connected: true,
    connectionError: null,
    enrollError: null,
  }),
  'connected',
)

assert.equal(
  resolveFoxBridgeSyncHomeStatus({
    connected: true,
    enrolled: true,
    deskRole: 'principal',
    connectionError: null,
  }),
  'connected_principal',
)

assert.equal(
  resolveFoxBridgeSyncHomeStatus({
    connected: true,
    enrolled: true,
    deskRole: 'legacy',
    connectionError: null,
  }),
  'connected_legacy',
)

assert.equal(
  resolveFoxBridgeSyncHomeStatus({
    connected: false,
    enrolled: false,
    deskRole: null,
    connectionError: null,
  }),
  'not_connected',
)

assert.equal(
  resolveFoxBridgeSyncHomeStatus({
    connected: false,
    enrolled: true,
    deskRole: 'legacy',
    connectionError: 'Desk credential expired.',
  }),
  'reconnect',
)

assert.equal(
  classifyFoxBridgeSyncIssue('Unable to verify RegFox access for this event.'),
  'verification_failed',
)
assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: false,
    needsTransferConfirmation: false,
    deskCredentialConfigured: false,
    connected: false,
    connectionError: null,
    enrollError: 'Unable to verify RegFox access for this event.',
  }),
  'verification_failed',
)

assert.equal(classifyFoxBridgeSyncIssue('fetch failed'), 'cloud_unavailable')
assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: false,
    needsTransferConfirmation: false,
    deskCredentialConfigured: false,
    connected: false,
    connectionError: null,
    enrollError: 'FoxBridge Cloud request failed (503).',
  }),
  'cloud_unavailable',
)

assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: false,
    needsTransferConfirmation: true,
    deskCredentialConfigured: false,
    connected: false,
    connectionError: null,
    enrollError: null,
  }),
  'confirm_transfer',
)

assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: false,
    needsTransferConfirmation: true,
    deskCredentialConfigured: true,
    connected: true,
    connectionError: null,
    enrollError: null,
  }),
  'connected',
)

assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: false,
    needsTransferConfirmation: false,
    deskCredentialConfigured: false,
    connected: false,
    connectionError: null,
    enrollError: 'Something unexpected happened.',
  }),
  'needs_retry',
)

// Operator enrollment codes still classified if used from Advanced Settings
assert.equal(classifyFoxBridgeSyncIssue('Invalid enrollment code.'), 'invalid_code')

assertNoRegFoxApiKeyInObject({
  success: true,
  conferenceId: 'conf-1',
  conferenceName: 'Demo',
  transferred: false,
  needsTransferConfirmation: false,
  message: null,
  deskRole: 'principal',
})

assert.throws(() =>
  assertNoRegFoxApiKeyInObject({
    success: false,
    regfoxApiKey: 'secret-should-not-appear',
  }),
)

assert.ok(!foxBridgeSyncIssueFallbackMessage('verification_failed').toLowerCase().includes('supabase'))
assert.ok(!foxBridgeSyncIssueFallbackMessage('cloud_unavailable').toLowerCase().includes('edge'))

const claimFn = readFileSync(
  join(root, 'supabase/functions/desktop-claim-principal/index.ts'),
  'utf8',
)
assert.ok(claimFn.includes('confirmTransfer'))
assert.ok(claimFn.includes('needsTransferConfirmation'))
assert.ok(claimFn.includes('409'))

const settingsService = readFileSync(
  join(root, 'electron/settings/settingsService.ts'),
  'utf8',
)
assert.ok(settingsService.includes('claimFoxBridgeCloudPrincipal'))
assert.ok(settingsService.includes('ownershipRegFoxApiKey'))
assert.ok(settingsService.includes('confirmTransfer'))

const enrollmentUi = readFileSync(
  join(root, 'src/features/sync/FoxBridgeSyncEnrollment.tsx'),
  'utf8',
)
assert.ok(enrollmentUi.includes('claimFoxBridgeCloudPrincipal'))
assert.ok(enrollmentUi.includes('confirmTransfer'))
assert.ok(enrollmentUi.includes('sync.setupMyEvent'))
assert.ok(enrollmentUi.includes('sync.joinExisting'))
assert.ok(enrollmentUi.includes('setupLater'))
assert.ok(enrollmentUi.includes('ownershipRegFoxApiKey'))
assert.equal(enrollmentUi.includes('useEnrollmentCode'), false)
assert.equal(enrollmentUi.includes('enrollFoxBridgeCloudDesktop'), false)
assert.equal(enrollmentUi.toLowerCase().includes('supabase'), false)
assert.equal(enrollmentUi.toLowerCase().includes('desk token'), false)

console.log('test-principal-setup-ux: ok')
