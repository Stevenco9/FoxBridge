import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  principalCredentialPersistedMatches,
  rotatedPrincipalCredentialReplacesPrior,
  selectReactivateDeskToken,
} from '../src/shared/cloud/principalReactivation.ts'
import { canManageLinkedDesks } from '../src/shared/cloud/deskRolePolicy.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

// --- Reactivation token offer (simulate post-restart local secrets) ---
assert.equal(
  selectReactivateDeskToken({ deskToken: 'prior-principal-token', role: 'principal' }),
  'prior-principal-token',
  'principal offers reactivation token',
)
assert.equal(
  selectReactivateDeskToken({ deskToken: 'prior-principal-token', role: null }),
  'prior-principal-token',
  'null role still offers token so missing local role cannot skip reactivation',
)
assert.equal(
  selectReactivateDeskToken({ deskToken: 'linked-token', role: 'linked' }),
  undefined,
  'linked must never offer reactivation token',
)
assert.equal(
  selectReactivateDeskToken({ deskToken: 'legacy-token', role: 'legacy' }),
  'legacy-token',
  'legacy may offer; Edge only reactivates if Cloud row is active Principal',
)

// --- Simulated lifecycle: existing Principal → restart → re-auth → rotate → persist → list ---
const priorToken = 'a'.repeat(64)
const rotatedToken = 'b'.repeat(64)
const deskDeviceId = 'desk-device-1'
const conferenceId = 'conference-1'

assert.equal(
  rotatedPrincipalCredentialReplacesPrior({
    priorToken,
    rotatedToken,
  }),
  true,
  'reactivation must rotate to a different raw desk token',
)

const priorHash = sha256Hex(priorToken)
const rotatedHash = sha256Hex(rotatedToken)
assert.notEqual(priorHash, rotatedHash, 'token_hash must change after rotation')

// After Edge returns rotated credential, Desktop must persist that exact token.
const persistedAfterReactivation = {
  deskToken: rotatedToken,
  deskDeviceId,
  conferenceId,
  role: 'principal' as const,
}
assert.equal(
  principalCredentialPersistedMatches(persistedAfterReactivation, {
    deskToken: rotatedToken,
    deskDeviceId,
    conferenceId,
  }),
  true,
  'persisted credential must match Cloud reactivation response',
)

// Stale pre-reactivation token must not be treated as the current Principal credential.
assert.equal(
  principalCredentialPersistedMatches(
    {
      deskToken: priorToken,
      deskDeviceId,
      conferenceId,
      role: 'principal',
    },
    {
      deskToken: rotatedToken,
      deskDeviceId,
      conferenceId,
    },
  ),
  false,
  'old pre-reactivation token must fail persistence match after rotation',
)

// Principal-only ops use the persisted (rotated) credential — role must remain principal.
assert.equal(canManageLinkedDesks(persistedAfterReactivation.role), true)
assert.equal(persistedAfterReactivation.deskToken, rotatedToken)
assert.notEqual(persistedAfterReactivation.deskToken, priorToken)

// --- Static wiring: Edge verifies rotate; Desktop persists + verifies read-back ---
const claimEdge = read('supabase/functions/desktop-claim-principal/index.ts')
assert.equal(claimEdge.includes('reactivateDeskToken'), true)
assert.equal(claimEdge.includes('principal_reactivated'), true)
assert.equal(claimEdge.includes(".select('id, role, conference_id')"), true, 'rotate must select row')
assert.equal(claimEdge.includes("rotated.role !== 'principal'"), true, 'rotate must verify Principal row')
assert.equal(claimEdge.includes('.eq(\'conference_id\', conferenceIdKey)'), true)

const desktopApi = read('electron/cloud/desktopCloudApi.ts')
assert.equal(desktopApi.includes('selectReactivateDeskToken'), true)
assert.equal(desktopApi.includes('principalCredentialPersistedMatches'), true)
assert.equal(desktopApi.includes("foxbridgeDeskRole: 'principal'"), true)

const secretStore = read('electron/settings/secretStore.ts')
assert.equal(secretStore.includes('secretsWriteChain'), true, 'serialize secret writes')

const panel = read('src/features/operations/ConnectedDesktopsPanel.tsx')
assert.equal(panel.includes('listFoxBridgeConnectedDesks'), true)
assert.equal(panel.includes('canManageLinkedDesks'), false, 'panel must not client-gate Principal')
assert.equal(panel.includes('isCloudPrincipalOnlyError'), true)
assert.equal(panel.includes("import { canManageLinkedDesks }"), false)

const deskAuth = read('supabase/functions/_shared/deskAuth.ts')
assert.equal(deskAuth.includes('assertPrincipalRole'), true)
assert.equal(
  deskAuth.includes('Only the Principal Desktop can manage conference devices.'),
  true,
  'assertPrincipalRole message unchanged',
)

console.log('test-principal-reactivation-credential: ok')
