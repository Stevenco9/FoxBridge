import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canManageLinkedDesks,
  canPerformStandardDeskOps,
  isLinkedCredentialStillValid,
  linkedCanBecomePrincipalByPossessionAlone,
} from '../src/shared/cloud/deskRolePolicy.ts'
import {
  DEFAULT_JOIN_CODE_TTL_MINUTES,
  LINKED_DESK_CREDENTIAL_HOURS,
  isJoinCodeTtlMinutesValid,
  normalizeJoinCode,
} from '../src/shared/cloud/deskCredentialPolicy.ts'
import {
  formatLinkedConnectedUntil,
  resolveFoxBridgeSyncHomeStatus,
} from '../src/shared/sync/foxbridgeSyncStatus.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// --- Role matrix ---
assert.equal(canManageLinkedDesks('principal'), true)
assert.equal(canManageLinkedDesks('linked'), false)
assert.equal(canManageLinkedDesks('legacy'), false)
assert.equal(canPerformStandardDeskOps('linked'), true)
assert.equal(linkedCanBecomePrincipalByPossessionAlone(), false)

assert.equal(isJoinCodeTtlMinutesValid(DEFAULT_JOIN_CODE_TTL_MINUTES), true)
assert.equal(isJoinCodeTtlMinutesValid(4), false)
assert.equal(isJoinCodeTtlMinutesValid(31), false)
assert.equal(LINKED_DESK_CREDENTIAL_HOURS, 48)
assert.equal(normalizeJoinCode(' a1b2-c3d4-e5f6 '), 'A1B2-C3D4-E5F6')
assert.equal(normalizeJoinCode('a1b2c3d4e5f6'), 'A1B2-C3D4-E5F6')
assert.equal(normalizeJoinCode('A1b2 C3d4-E5f6'), 'A1B2-C3D4-E5F6')
assert.equal(normalizeJoinCode('short'), '')
assert.equal(normalizeJoinCode('A1B2-C3D4-E5F6-7890'), '')

const future = new Date(Date.now() + 60_000).toISOString()
const past = new Date(Date.now() - 60_000).toISOString()
assert.equal(
  isLinkedCredentialStillValid({ role: 'linked', expiresAt: future }),
  true,
)
assert.equal(
  isLinkedCredentialStillValid({ role: 'linked', expiresAt: past }),
  false,
)
assert.equal(
  isLinkedCredentialStillValid({
    role: 'linked',
    expiresAt: future,
    revokedAt: new Date().toISOString(),
  }),
  false,
)
assert.equal(
  isLinkedCredentialStillValid({ role: 'principal', expiresAt: null }),
  true,
)

assert.equal(
  resolveFoxBridgeSyncHomeStatus({
    connected: true,
    enrolled: true,
    deskRole: 'linked',
    connectionError: null,
  }),
  'connected_linked',
)

assert.ok(formatLinkedConnectedUntil(future).length > 0)

// --- Migration 012 invariants ---
const migration012 = readFileSync(
  join(root, 'supabase/migrations/012_linked_desk_join_codes.sql'),
  'utf8',
)
assert.ok(migration012.includes('desk_join_codes'))
assert.ok(migration012.includes('issue_desk_join_code'))
assert.ok(migration012.includes('redeem_desk_join_code'))
assert.ok(migration012.includes('revoke_linked_desk_device'))
assert.ok(migration012.includes("'linked'"))
assert.ok(migration012.includes("interval '48 hours'") || migration012.includes('48 hours'))
assert.ok(migration012.includes('join_code_issued'))
assert.ok(migration012.includes('join_code_redeemed'))
assert.ok(migration012.includes('linked_desktop_created'))
assert.ok(migration012.includes('linked_desktop_revoked'))
assert.ok(migration012.includes('LEAST(COALESCE(p_ttl_minutes, 15), 30)'))
assert.equal(migration012.includes('raw_code'), true)
// raw code returned from RPC but never stored in desk_join_codes insert columns as plaintext beyond return
assert.ok(migration012.includes('code_hash'))
assert.ok(
  /INSERT INTO desk_join_codes \(\s*id,\s*conference_id,\s*code_hash/.test(migration012),
)
assert.equal(migration012.includes('INSERT INTO desk_join_codes (raw_code'), false)

// --- Edge Function static checks ---
const issueFn = readFileSync(
  join(root, 'supabase/functions/desktop-issue-join-code/index.ts'),
  'utf8',
)
assert.ok(issueFn.includes('assertPrincipalRole'))
assert.ok(issueFn.includes('issue_desk_join_code'))
assert.ok(issueFn.includes('joinCode'))

const redeemFn = readFileSync(
  join(root, 'supabase/functions/desktop-redeem-join/index.ts'),
  'utf8',
)
assert.ok(redeemFn.includes('redeem_desk_join_code'))
assert.ok(redeemFn.includes("role: 'linked'"))
assert.ok(redeemFn.includes('expiresAt'))
assert.ok(redeemFn.includes('JOIN_CODE_EXPIRED'))
assert.ok(redeemFn.includes('JOIN_CODE_USED'))
assert.ok(redeemFn.includes('canonicalizeJoinCode'))
assert.ok(redeemFn.includes('installationId'))
assert.equal(redeemFn.includes('confirmTransfer'), false)

const listFn = readFileSync(
  join(root, 'supabase/functions/desktop-list-desks/index.ts'),
  'utf8',
)
assert.ok(listFn.includes('assertPrincipalRole'))
assert.ok(listFn.includes('id, label, role, created_at, expires_at, revoked_at, last_used_at'))
assert.equal(listFn.includes('token_hash'), false)
assert.equal(listFn.includes('regfoxApiKey'), false)

const revokeFn = readFileSync(
  join(root, 'supabase/functions/desktop-revoke-desk/index.ts'),
  'utf8',
)
assert.ok(revokeFn.includes('assertPrincipalRole'))
assert.ok(revokeFn.includes('revoke_linked_desk_device'))
assert.ok(revokeFn.includes('Only Linked Desktops'))

const deskAuth = readFileSync(
  join(root, 'supabase/functions/_shared/deskAuth.ts'),
  'utf8',
)
assert.ok(deskAuth.includes('expires_at'))
assert.ok(deskAuth.includes('Desk credential has expired'))
assert.ok(deskAuth.includes('assertPrincipalRole'))

// Principal claim path unchanged (still present; no join-code dependency)
const claimFn = readFileSync(
  join(root, 'supabase/functions/desktop-claim-principal/index.ts'),
  'utf8',
)
assert.ok(claimFn.includes('confirmTransfer'))
assert.ok(claimFn.includes('desktop-claim-principal') || claimFn.includes('verifyRegFoxEventAccess'))

// Phone pairing functions unchanged (no assertPrincipalRole / join code wiring)
const pairingFn = readFileSync(
  join(root, 'supabase/functions/desktop-create-pairing/index.ts'),
  'utf8',
)
assert.ok(pairingFn.includes('requireDeskDevice'))
assert.equal(pairingFn.includes('assertPrincipalRole'), false)
assert.equal(pairingFn.includes('join'), false)

// Enrollment UI still has Principal claim; join path added; no API key exposure
const enrollmentUi = readFileSync(
  join(root, 'src/features/sync/FoxBridgeSyncEnrollment.tsx'),
  'utf8',
)
// Enrollment UI: join + ownership Principal claim; no accidental secret logging helpers
assert.ok(enrollmentUi.includes('claimFoxBridgeCloudPrincipal'))
assert.ok(enrollmentUi.includes('redeemFoxBridgeLinkedJoin'))
assert.ok(enrollmentUi.includes('joinExisting'))
assert.ok(enrollmentUi.includes('ownershipRegFoxApiKey'))
assert.ok(enrollmentUi.includes('sync.setupMyEvent'))
assert.equal(enrollmentUi.includes('useEnrollmentCode'), false)
assert.equal(enrollmentUi.toLowerCase().includes('supabase'), false)
assert.equal(enrollmentUi.toLowerCase().includes('desk token'), false)

const desksUi = readFileSync(
  join(root, 'src/features/operations/ConnectedDesktopsPanel.tsx'),
  'utf8',
)
assert.ok(desksUi.includes('issueFoxBridgeJoinCode'))
assert.ok(desksUi.includes('revokeFoxBridgeLinkedDesktop'))
assert.ok(desksUi.includes('listFoxBridgeConnectedDesks'))
assert.ok(desksUi.includes('isCloudPrincipalOnlyError'))
assert.equal(desksUi.includes('canManageLinkedDesks'), false)
assert.ok(desksUi.includes('formatJoinCodeRemaining'))
assert.ok(desksUi.includes('desks.codeExpired'))
assert.equal(desksUi.toLowerCase().includes('token_hash'), false)
assert.equal(desksUi.toLowerCase().includes('supabase'), false)

console.log('test-linked-desk-join: ok')
