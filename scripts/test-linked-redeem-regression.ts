/**
 * Sprint 22.5 closeout — redeem regression + false Connected status.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalizeJoinCode,
  normalizeJoinCode,
} from '../src/shared/cloud/deskCredentialPolicy.ts'
import {
  classifyFoxBridgeSyncIssue,
  resolveFoxBridgeSyncPhase,
} from '../src/shared/sync/foxbridgeSyncStatus.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// Canonicalization still matches issuance shape (dashed 12-hex)
assert.equal(canonicalizeJoinCode('a1b2c3d4e5f6'), 'A1B2-C3D4-E5F6')
assert.equal(normalizeJoinCode('A1B2-C3D4-E5F6'), 'A1B2-C3D4-E5F6')

// Migration 014 allows linked_desktop_rejoined (013 wrote this action)
const migration014 = readFileSync(
  join(root, 'supabase/migrations/014_fix_linked_desktop_rejoined_audit.sql'),
  'utf8',
)
assert.ok(migration014.includes('linked_desktop_rejoined'))
assert.ok(migration014.includes('desk_device_audit_action_check'))

const migration013 = readFileSync(
  join(root, 'supabase/migrations/013_linked_desk_installation_identity.sql'),
  'utf8',
)
assert.ok(migration013.includes("'linked_desktop_rejoined'"))
assert.ok(migration013.includes('p_installation_id'))
assert.ok(migration013.includes('JOIN_CODE_USED'))
assert.ok(migration013.includes('token_hash = lower(trim(p_token_hash))'))
// Consume only after desk insert/update in same function (transactional)
const consumeIdx = migration013.indexOf('UPDATE desk_join_codes')
const insertIdx = migration013.indexOf('INSERT INTO desk_devices')
const updateIdx = migration013.indexOf('UPDATE desk_devices')
assert.ok(consumeIdx > 0)
assert.ok(consumeIdx > insertIdx || consumeIdx > updateIdx)

// Edge RPC call shape matches 4-arg redeem
const redeemFn = readFileSync(
  join(root, 'supabase/functions/desktop-redeem-join/index.ts'),
  'utf8',
)
assert.ok(redeemFn.includes("rpc('redeem_desk_join_code'"))
assert.ok(redeemFn.includes('p_code_hash'))
assert.ok(redeemFn.includes('p_token_hash'))
assert.ok(redeemFn.includes('p_label'))
assert.ok(redeemFn.includes('p_installation_id'))
assert.ok(redeemFn.includes('canonicalizeJoinCode'))
assert.ok(redeemFn.includes('sha256Hex(joinCode)'))

// Desktop does not persist secrets before validating redeem payload
const desktopApi = readFileSync(
  join(root, 'electron/cloud/desktopCloudApi.ts'),
  'utf8',
)
const redeemStart = desktopApi.indexOf('export async function redeemLinkedDesktopJoin')
const redeemSlice = desktopApi.slice(redeemStart, redeemStart + 4500)
assert.ok(redeemSlice.includes('if (!result.deskToken'))
assert.ok(redeemSlice.includes('await patchSecrets'))
const validateBeforePatch =
  redeemSlice.indexOf('if (!result.deskToken') < redeemSlice.indexOf('await patchSecrets')
assert.equal(validateBeforePatch, true)

// Failed join UI must not stay silent on enter_code
assert.equal(
  classifyFoxBridgeSyncIssue('Unable to connect with that code.'),
  'invalid_code',
)
assert.equal(
  classifyFoxBridgeSyncIssue('That connection code did not work. Check the code and try again.'),
  'invalid_code',
)
assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: true,
    needsTransferConfirmation: false,
    deskCredentialConfigured: false,
    connected: false,
    connectionError: null,
    enrollError: 'new row violates check constraint "desk_device_audit_action_check"',
  }),
  'needs_retry',
)
assert.equal(
  resolveFoxBridgeSyncPhase({
    isConnecting: false,
    codeEntryVisible: true,
    needsTransferConfirmation: false,
    deskCredentialConfigured: false,
    connected: false,
    connectionError: null,
    enrollError: 'That connection code did not work. Check the code and try again.',
  }),
  'invalid_code',
)

const enrollmentUi = readFileSync(
  join(root, 'src/features/sync/FoxBridgeSyncEnrollment.tsx'),
  'utf8',
)
assert.ok(enrollmentUi.includes("enrollError && panelMode === 'join'"))
assert.ok(enrollmentUi.includes('sync.error.invalidCode'))

// Operations Home refreshes when Sync panel closes (not only on success)
const attendeeScreen = readFileSync(
  join(root, 'src/features/attendees/AttendeeSearchScreen.tsx'),
  'utf8',
)
assert.ok(attendeeScreen.includes('setFoxbridgeSyncOpen(false)'))
assert.ok(attendeeScreen.includes('refreshMeta()'))
assert.ok(attendeeScreen.includes('stale Connected'))

// Installation ID store must not throw into join path
const installStore = readFileSync(
  join(root, 'electron/cloud/installationIdStore.ts'),
  'utf8',
)
assert.ok(installStore.includes('tryPersistInstallationId'))
assert.ok(installStore.includes('Non-fatal'))

// Principal / pairing unchanged markers
assert.equal(redeemFn.includes('claimFoxBridgeCloudPrincipal'), false)
assert.equal(redeemFn.includes('desktop-create-pairing'), false)

console.log('test-linked-redeem-regression: ok')
