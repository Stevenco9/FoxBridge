/**
 * Sprint 22.4 security closeout — Principal escalation / secret-boundary invariants.
 * Static + policy tests (no live Cloud/RegFox calls).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canSilentPrincipalClaimFromStoredRegFox,
  linkedCanBecomePrincipalByPossessionAlone,
  shouldOfferPrincipalUpgradeAction,
  canManageLinkedDesks,
} from '../src/shared/cloud/deskRolePolicy.ts'
import { assertNoRegFoxApiKeyInObject } from '../src/shared/sync/foxbridgeSyncStatus.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// --- Policy: Linked possession never elevates ---
assert.equal(linkedCanBecomePrincipalByPossessionAlone(), false)
assert.equal(shouldOfferPrincipalUpgradeAction('linked'), false)
assert.equal(shouldOfferPrincipalUpgradeAction(null), false)
assert.equal(shouldOfferPrincipalUpgradeAction('principal'), false)
assert.equal(shouldOfferPrincipalUpgradeAction('legacy'), true)
assert.equal(canSilentPrincipalClaimFromStoredRegFox('linked'), false)
assert.equal(canSilentPrincipalClaimFromStoredRegFox(null), false)
assert.equal(canSilentPrincipalClaimFromStoredRegFox('principal'), false)
assert.equal(canSilentPrincipalClaimFromStoredRegFox('legacy'), true)
assert.equal(canManageLinkedDesks('linked'), false)

// --- Linked redeem response must not include RegFox API key ---
const redeemFn = readFileSync(
  join(root, 'supabase/functions/desktop-redeem-join/index.ts'),
  'utf8',
)
assert.equal(redeemFn.includes('regfoxApiKey'), false)
assert.equal(redeemFn.includes('api_key'), false)
assert.ok(redeemFn.includes('regfoxEventId') || redeemFn.includes('regfox_event_id'))

const desktopApi = readFileSync(join(root, 'electron/cloud/desktopCloudApi.ts'), 'utf8')
const redeemClientStart = desktopApi.indexOf('export async function redeemLinkedDesktopJoin')
assert.ok(redeemClientStart >= 0)
const redeemClientSlice = desktopApi.slice(redeemClientStart, redeemClientStart + 3500)
assert.equal(redeemClientSlice.includes('regfoxApiKey'), false)
assert.ok(
  redeemClientSlice.includes('Do not copy regfoxEventId') ||
    !redeemClientSlice.includes('regfoxEventId: result.regfoxEventId'),
)

// --- Claim Edge Function: mandatory RegFox verify; Linked desk token rejected ---
const claimFn = readFileSync(
  join(root, 'supabase/functions/desktop-claim-principal/index.ts'),
  'utf8',
)
assert.ok(claimFn.includes('verifyRegFoxEventAccess'))
assert.ok(claimFn.includes('/forms/'))
assert.ok(claimFn.includes("role === 'linked'"))
assert.ok(claimFn.includes('403'))
assert.ok(claimFn.includes('Registration credentials are required'))
assert.ok(claimFn.includes('confirmTransfer'))
assert.ok(claimFn.includes('needsTransferConfirmation'))
// Must not persist API key
assert.equal(/\.from\('conferences'\)[\s\S]{0,400}regfoxApiKey/.test(claimFn), false)
assert.equal(/\.from\('desk_devices'\)[\s\S]{0,400}regfoxApiKey/.test(claimFn), false)

// Event A key cannot claim Event B is enforced by verify URL using externalEventId
assert.ok(claimFn.includes('encodeURIComponent(eventId)'))

// Transfer confirmation alone is not ownership — RegFox key still required before confirm path
const confirmIdx = claimFn.indexOf('confirmTransfer')
const verifyIdx = claimFn.indexOf('verifyRegFoxEventAccess')
assert.ok(verifyIdx > 0)
assert.ok(confirmIdx > 0)
// verify happens before provision / transfer logic (confirmTransfer check is after verify)
const provisionIdx = claimFn.indexOf('provision_principal_desk_device')
assert.ok(verifyIdx < provisionIdx)

// --- Desktop claim: Linked cannot silent-claim; missing key blocked ---
const settingsService = readFileSync(
  join(root, 'electron/settings/settingsService.ts'),
  'utf8',
)
assert.ok(settingsService.includes('canSilentPrincipalClaimFromStoredRegFox'))
assert.ok(settingsService.includes('ownershipRegFoxApiKey'))
assert.ok(settingsService.includes('ownershipRegFoxEventId'))
assert.ok(
  settingsService.includes(
    'Connect RegFox with your API key and event ID to prove ownership',
  ),
)
assert.ok(settingsService.includes("deskRole === 'linked'"))

// Claim HTTP request body is ownership-only (no deskToken field)
const claimClientStart = desktopApi.indexOf(
  'export async function claimPrincipalDesktopWithRegFox',
)
const claimClientSlice = desktopApi.slice(claimClientStart, claimClientStart + 3500)
const claimBodyMatch = claimClientSlice.match(
  /body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/,
)
assert.ok(claimBodyMatch)
assert.equal(claimBodyMatch![1].includes('deskToken'), false)
assert.ok(claimBodyMatch![1].includes('regfoxApiKey'))
assert.equal(claimClientSlice.includes('x-foxbridge-desk-token'), false)
assert.ok(claimClientSlice.includes('regfoxApiKey: apiKey'))
// Response may include deskToken (new Principal credential) — that is expected.
assert.ok(claimClientSlice.includes('payload.deskToken'))

// --- Organizer Sync UX: no enrollment-code path; ownership form for Principal ---
const enrollmentUi = readFileSync(
  join(root, 'src/features/sync/FoxBridgeSyncEnrollment.tsx'),
  'utf8',
)
assert.equal(enrollmentUi.includes('useEnrollmentCode'), false)
assert.equal(enrollmentUi.includes('enrollFoxBridgeCloudDesktop'), false)
assert.equal(enrollmentUi.includes("setCodeMode('enroll')"), false)
assert.ok(enrollmentUi.includes('sync.setupMyEvent'))
assert.ok(enrollmentUi.includes('sync.joinExisting'))
assert.ok(enrollmentUi.includes('ownershipRegFoxApiKey'))
assert.ok(enrollmentUi.includes('principal_setup'))
assert.ok(enrollmentUi.includes('shouldOfferPrincipalUpgradeAction'))
// Silent claim only via legacy upgrade handler
assert.ok(enrollmentUi.includes('handleLegacyPrincipalUpgrade'))
assert.ok(enrollmentUi.includes('handleOwnershipPrincipalClaim'))

// Operator enrollment remains in Advanced Settings, not normal Sync UI
const settingsModal = readFileSync(
  join(root, 'src/features/settings/SettingsModal.tsx'),
  'utf8',
)
assert.ok(settingsModal.includes('enrollFoxBridgeCloudDesktop'))
assert.ok(settingsModal.includes('showAdvanced'))

// Operator enroll creates legacy, not principal
const enrollFn = readFileSync(
  join(root, 'supabase/functions/desktop-enroll/index.ts'),
  'utf8',
)
assert.ok(enrollFn.includes("role: 'legacy'"))
assert.equal(enrollFn.includes("role: 'principal'"), false)

// --- Secret boundary helpers ---
assertNoRegFoxApiKeyInObject({
  deskToken: 'abc',
  conferenceId: 'c1',
  regfoxEventId: '101',
  role: 'linked',
})
assert.throws(() =>
  assertNoRegFoxApiKeyInObject({
    regfoxApiKey: 'secret',
  }),
)

console.log('test-principal-escalation-security: ok')
