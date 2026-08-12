/**
 * Sprint 22.4 — update Principal claim / Sync UX static expectations after
 * ownership-proof hardening (Linked must not silent-claim).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canSilentPrincipalClaimFromStoredRegFox,
  linkedCanBecomePrincipalByPossessionAlone,
  shouldOfferPrincipalUpgradeAction,
} from '../src/shared/cloud/deskRolePolicy.ts'
import {
  assertNoRegFoxApiKeyInObject,
  resolveFoxBridgeSyncHomeStatus,
  resolveFoxBridgeSyncPhase,
} from '../src/shared/sync/foxbridgeSyncStatus.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

assert.equal(shouldOfferPrincipalUpgradeAction('legacy'), true)
assert.equal(shouldOfferPrincipalUpgradeAction('linked'), false)
assert.equal(shouldOfferPrincipalUpgradeAction(null), false)
assert.equal(linkedCanBecomePrincipalByPossessionAlone(), false)
assert.equal(canSilentPrincipalClaimFromStoredRegFox('legacy'), true)
assert.equal(canSilentPrincipalClaimFromStoredRegFox('linked'), false)

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
    deskRole: 'legacy',
    connectionError: null,
  }),
  'connected_legacy',
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

const settingsService = readFileSync(
  join(root, 'electron/settings/settingsService.ts'),
  'utf8',
)
assert.ok(settingsService.includes('claimFoxBridgeCloudPrincipal'))
assert.ok(settingsService.includes('canSilentPrincipalClaimFromStoredRegFox'))
assert.ok(settingsService.includes('ownershipRegFoxApiKey'))

const enrollmentUi = readFileSync(
  join(root, 'src/features/sync/FoxBridgeSyncEnrollment.tsx'),
  'utf8',
)
assert.ok(enrollmentUi.includes('shouldOfferPrincipalUpgradeAction'))
assert.ok(enrollmentUi.includes('sync.upgrade.action'))
assert.ok(enrollmentUi.includes('claimFoxBridgeCloudPrincipal'))
assert.ok(enrollmentUi.includes('confirmTransfer'))
assert.ok(enrollmentUi.includes('handleLegacyPrincipalUpgrade'))
assert.equal(enrollmentUi.includes('useEnrollmentCode'), false)
assert.equal(enrollmentUi.includes("shouldOfferPrincipalUpgradeAction('linked')"), false)

const desktopApi = readFileSync(
  join(root, 'electron/cloud/desktopCloudApi.ts'),
  'utf8',
)
const claimFnStart = desktopApi.indexOf('export async function claimPrincipalDesktopWithRegFox')
assert.ok(claimFnStart >= 0)
const claimSlice = desktopApi.slice(claimFnStart, claimFnStart + 4500)
assert.ok(claimSlice.includes('await patchSecrets'))
assert.ok(claimSlice.includes('if (!response.ok)'))
const firstPatch = claimSlice.indexOf('await patchSecrets')
const notOk = claimSlice.indexOf('if (!response.ok)')
assert.ok(firstPatch > notOk)

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
    deskRole: 'legacy',
    regfoxApiKey: 'should-not-leak',
  }),
)

console.log('test-legacy-principal-upgrade: ok')
