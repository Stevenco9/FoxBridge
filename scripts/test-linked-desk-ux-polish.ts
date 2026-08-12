/**
 * Sprint 22.5 — Linked Desktop UX polish (join canonicalize, countdown, installation identity).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalizeJoinCode,
  formatJoinCodeRemaining,
  isFoxBridgeInstallationId,
  normalizeJoinCode,
} from '../src/shared/cloud/deskCredentialPolicy.ts'
import { canManageLinkedDesks } from '../src/shared/cloud/deskRolePolicy.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// --- Join-code canonicalization ---
assert.equal(canonicalizeJoinCode('A1B2-C3D4-E5F6'), 'A1B2-C3D4-E5F6')
assert.equal(canonicalizeJoinCode('a1b2c3d4e5f6'), 'A1B2-C3D4-E5F6')
assert.equal(canonicalizeJoinCode('A1b2-C3d4-E5f6'), 'A1B2-C3D4-E5F6')
assert.equal(canonicalizeJoinCode('  a1b2 c3d4 e5f6  '), 'A1B2-C3D4-E5F6')
assert.equal(canonicalizeJoinCode('a1b2--c3d4--e5f6'), 'A1B2-C3D4-E5F6')
assert.equal(canonicalizeJoinCode('A1B2-C3D4-E5F'), null)
assert.equal(canonicalizeJoinCode('A1B2-C3D4-E5F67'), null)
assert.equal(canonicalizeJoinCode('ZZZZ-ZZZZ-ZZZZ'), null) // not hex
assert.equal(canonicalizeJoinCode(''), null)
assert.equal(normalizeJoinCode('a1b2c3d4e5f6'), 'A1B2-C3D4-E5F6')
assert.equal(normalizeJoinCode('bad'), '')

// Edge Function mirrors Desktop canonicalize before hash
const redeemFn = readFileSync(
  join(root, 'supabase/functions/desktop-redeem-join/index.ts'),
  'utf8',
)
assert.ok(redeemFn.includes('canonicalizeJoinCode'))
assert.ok(redeemFn.includes('sha256Hex(joinCode)'))
assert.ok(redeemFn.includes('p_installation_id'))
// Still rejects used/expired via RPC errors
assert.ok(redeemFn.includes('JOIN_CODE_USED'))
assert.ok(redeemFn.includes('JOIN_CODE_EXPIRED'))
assert.ok(redeemFn.includes('JOIN_CODE_INVALID'))

const joinShared = readFileSync(
  join(root, 'supabase/functions/_shared/joinCode.ts'),
  'utf8',
)
assert.ok(joinShared.includes('canonicalizeJoinCode'))
assert.ok(joinShared.includes('isFoxBridgeInstallationId'))

// Desktop redeem also canonicalizes + sends installation id
const desktopApi = readFileSync(
  join(root, 'electron/cloud/desktopCloudApi.ts'),
  'utf8',
)
assert.ok(desktopApi.includes('canonicalizeJoinCode'))
assert.ok(desktopApi.includes('readOrCreateInstallationIdSync'))
assert.ok(desktopApi.includes('installationId'))

// --- Countdown formatting (UI only; does not extend server TTL) ---
const future = new Date(Date.now() + 14 * 60_000 + 32_000).toISOString()
const live = formatJoinCodeRemaining(future, Date.now())
assert.equal(live.expired, false)
assert.ok(live.remainingSeconds >= 14 * 60 + 30)
assert.match(live.mmss, /^\d+:\d{2}$/)

const past = new Date(Date.now() - 1000).toISOString()
const gone = formatJoinCodeRemaining(past, Date.now())
assert.equal(gone.expired, true)
assert.equal(gone.remainingSeconds, 0)
assert.equal(gone.mmss, '0:00')

const desksUi = readFileSync(
  join(root, 'src/features/operations/ConnectedDesktopsPanel.tsx'),
  'utf8',
)
assert.ok(desksUi.includes('formatJoinCodeRemaining'))
assert.ok(desksUi.includes('setNowMs'))
assert.ok(desksUi.includes('setInterval'))
assert.ok(desksUi.includes('desks.codeExpired'))
assert.ok(desksUi.includes('desks.codeExpiresIn'))

// --- Installation identity ---
assert.equal(isFoxBridgeInstallationId('550e8400-e29b-41d4-a716-446655440000'), true)
assert.equal(isFoxBridgeInstallationId('not-a-uuid'), false)
assert.equal(isFoxBridgeInstallationId(''), false)

const installStore = readFileSync(
  join(root, 'electron/cloud/installationIdStore.ts'),
  'utf8',
)
assert.ok(installStore.includes('randomUUID'))
assert.ok(installStore.includes('installation.json'))
assert.equal(installStore.toLowerCase().includes('mac address'), false)
assert.equal(installStore.toLowerCase().includes('serial'), false)

const migration013 = readFileSync(
  join(root, 'supabase/migrations/013_linked_desk_installation_identity.sql'),
  'utf8',
)
assert.ok(migration013.includes('installation_id'))
assert.ok(migration013.includes('desk_devices_conference_installation_linked_uidx'))
assert.ok(migration013.includes('linked_desktop_rejoined'))
assert.ok(migration013.includes('linked_desktop_created'))
assert.ok(migration013.includes('token_hash = lower(trim(p_token_hash))'))
assert.ok(migration013.includes('revoked_at = NULL'))
assert.ok(migration013.includes('p_installation_id'))
// Fresh join code still required — redeem still gates on unused/unexpired code
assert.ok(migration013.includes('JOIN_CODE_USED'))
assert.ok(migration013.includes('JOIN_CODE_EXPIRED'))
assert.ok(migration013.includes('JOIN_CODE_INVALID'))

// Installation id alone cannot authenticate (no requireDeskDevice on installation)
assert.equal(redeemFn.includes('requireDeskDevice'), false)
assert.equal(migration013.includes('installation_id') && migration013.includes('token_hash'), true)

// Another installation gets a separate row — unique is (conference, installation)
assert.ok(migration013.includes('(conference_id, installation_id)'))

// Principal management unchanged
assert.equal(canManageLinkedDesks('principal'), true)
assert.equal(canManageLinkedDesks('linked'), false)

const issueFn = readFileSync(
  join(root, 'supabase/functions/desktop-issue-join-code/index.ts'),
  'utf8',
)
assert.ok(issueFn.includes('assertPrincipalRole'))

const pairingFn = readFileSync(
  join(root, 'supabase/functions/desktop-create-pairing/index.ts'),
  'utf8',
)
assert.ok(pairingFn.includes('requireDeskDevice'))
assert.equal(pairingFn.includes('installationId'), false)

const claimFn = readFileSync(
  join(root, 'supabase/functions/desktop-claim-principal/index.ts'),
  'utf8',
)
assert.ok(claimFn.includes('verifyRegFoxEventAccess'))
assert.equal(claimFn.includes('installationId'), false)

console.log('test-linked-desk-ux-polish: ok')
