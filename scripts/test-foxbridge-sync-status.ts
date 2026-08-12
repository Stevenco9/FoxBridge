import assert from 'node:assert/strict'
import {
  classifyFoxBridgeSyncIssue,
  foxBridgeSyncIssueFallbackMessage,
  resolveFoxBridgeSyncPhase,
} from '../src/shared/sync/foxbridgeSyncStatus.ts'

assert.equal(classifyFoxBridgeSyncIssue(null), 'none')
assert.equal(classifyFoxBridgeSyncIssue('Invalid enrollment code.'), 'invalid_code')
assert.equal(classifyFoxBridgeSyncIssue('This enrollment code has already been used.'), 'invalid_code')
assert.equal(classifyFoxBridgeSyncIssue('Enrollment code has expired.'), 'expired_code')
assert.equal(classifyFoxBridgeSyncIssue('Desk credential has been revoked.'), 'revoked')
assert.equal(classifyFoxBridgeSyncIssue('Desk credential expired.'), 'needs_reenrollment')
assert.equal(classifyFoxBridgeSyncIssue('Invalid desk credential.'), 'needs_reenrollment')

assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: true,
    codeEntryVisible: true,
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
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: true,
    needsTransferConfirmation: false,
    deskCredentialConfigured: false,
    connected: false,
    connectionError: null,
    enrollError: null,
  }),
  'enter_code',
)

assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: false,
    needsTransferConfirmation: false,
    deskCredentialConfigured: true,
    connected: false,
    connectionError: 'Desk credential has been revoked.',
    enrollError: null,
  }),
  'revoked',
)

assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: false,
    needsTransferConfirmation: false,
    deskCredentialConfigured: true,
    connected: false,
    connectionError: 'Desk credential expired.',
    enrollError: null,
  }),
  'needs_reenrollment',
)

assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: true,
    needsTransferConfirmation: false,
    deskCredentialConfigured: false,
    connected: false,
    connectionError: null,
    enrollError: 'Invalid enrollment code.',
  }),
  'invalid_code',
)

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

assert.ok(foxBridgeSyncIssueFallbackMessage('invalid_code').length > 0)
assert.ok(!foxBridgeSyncIssueFallbackMessage('invalid_code').toLowerCase().includes('supabase'))
assert.ok(!foxBridgeSyncIssueFallbackMessage('revoked').toLowerCase().includes('token'))
assert.ok(!foxBridgeSyncIssueFallbackMessage('needs_reenrollment').toLowerCase().includes('desk'))

console.log('test-foxbridge-sync-status: ok')
