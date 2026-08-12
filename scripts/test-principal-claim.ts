import assert from 'node:assert/strict'
import {
  buildCanonicalEventKey,
  canManageLinkedDesks,
  canPerformStandardDeskOps,
  defaultMigratedDeskRole,
  isDeskDeviceRole,
  linkedCanBecomePrincipalByPossessionAlone,
  normalizeExternalEventId,
  normalizeRegistrationPlatform,
  sanitizeUpstreamErrorMessage,
} from '../src/shared/cloud/deskRolePolicy.ts'
import {
  isConferenceAuthorizedForDesk,
  resolveCloudOpsTransport,
} from '../src/shared/cloud/deskCredentialPolicy.ts'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// --- Roles / authorization matrix ---
assert.equal(defaultMigratedDeskRole(), 'legacy')
assert.equal(isDeskDeviceRole('principal'), true)
assert.equal(isDeskDeviceRole('linked'), true)
assert.equal(isDeskDeviceRole('legacy'), true)
assert.equal(isDeskDeviceRole('admin'), false)

assert.equal(canPerformStandardDeskOps('principal'), true)
assert.equal(canPerformStandardDeskOps('linked'), true)
assert.equal(canPerformStandardDeskOps('legacy'), true)

assert.equal(canManageLinkedDesks('principal'), true)
assert.equal(canManageLinkedDesks('linked'), false)
assert.equal(canManageLinkedDesks('legacy'), false)

assert.equal(linkedCanBecomePrincipalByPossessionAlone(), false)

// Sprint 21 desk transport still prefers desk credential when present.
assert.equal(
  resolveCloudOpsTransport({
    publicConfigured: true,
    deskTokenPresent: true,
    legacyPrivilegedKeyPresent: false,
  }),
  'desk_credential',
)

assert.equal(
  isConferenceAuthorizedForDesk({
    deskConferenceId: 'conf-a',
    requestedConferenceId: 'conf-b',
  }),
  false,
)

// --- Canonical event identity ---
assert.equal(normalizeRegistrationPlatform('RegFox'), 'regfox')
assert.equal(normalizeRegistrationPlatform('other'), null)
assert.equal(normalizeExternalEventId(' 1012457 '), '1012457')
assert.equal(buildCanonicalEventKey('regfox', '1012457'), 'regfox:1012457')

// --- Credential leakage hygiene ---
assert.ok(
  !sanitizeUpstreamErrorMessage('apiKey=supersecretvalue123 and more').includes(
    'supersecretvalue123',
  ),
)
assert.ok(sanitizeUpstreamErrorMessage('eyJabc.def.ghi leaked').includes('[redacted]'))
assert.ok(
  !sanitizeUpstreamErrorMessage('sb_publishable_abc123XYZ').includes('sb_publishable_abc123XYZ'),
)

// --- Migration 011 invariants present ---
const migration011 = readFileSync(
  join(root, 'supabase/migrations/011_principal_desk_provisioning.sql'),
  'utf8',
)
assert.ok(migration011.includes('registration_platform'))
assert.ok(migration011.includes('external_event_id'))
assert.ok(migration011.includes('conferences_platform_external_event_uidx'))
assert.ok(migration011.includes("role IN ('principal', 'linked', 'legacy')"))
assert.ok(migration011.includes('desk_devices_one_active_principal_uidx'))
assert.ok(migration011.includes('provision_principal_desk_device'))
assert.ok(migration011.includes('principal_claimed'))
assert.ok(migration011.includes('principal_transferred'))
assert.ok(migration011.includes('principal_revoked'))
assert.ok(migration011.includes('Cannot add unique external event identity'))

// --- Edge Function security invariants (static) ---
const claimFn = readFileSync(
  join(root, 'supabase/functions/desktop-claim-principal/index.ts'),
  'utf8',
)
assert.ok(claimFn.includes('desktop-claim-principal') || claimFn.includes('verifyRegFoxEventAccess'))
assert.ok(claimFn.includes('/forms/'))
assert.ok(claimFn.includes('provision_principal_desk_device'))
assert.ok(claimFn.includes("role: 'principal'") || claimFn.includes("role: \"principal\""))
// Must not persist API key in DB writes / audit payloads
assert.equal(/\.from\('conferences'\)[\s\S]{0,400}regfoxApiKey/.test(claimFn), false)
assert.equal(/\.from\('desk_devices'\)[\s\S]{0,400}regfoxApiKey/.test(claimFn), false)
assert.equal(/\.from\('desk_device_audit'\)[\s\S]{0,400}regfoxApiKey/.test(claimFn), false)
assert.ok(claimFn.includes('confirmTransfer'))
assert.ok(claimFn.includes('needsTransferConfirmation'))
assert.ok(claimFn.includes('regfoxApiKey = null'))
assert.ok(claimFn.includes("role === 'linked'"))
assert.equal(claimFn.includes('console.log') && /console\.log\([\s\S]*regfoxApiKey/.test(claimFn), false)

const enrollFn = readFileSync(
  join(root, 'supabase/functions/desktop-enroll/index.ts'),
  'utf8',
)
assert.ok(enrollFn.includes("role: 'legacy'"))

const deskAuth = readFileSync(
  join(root, 'supabase/functions/_shared/deskAuth.ts'),
  'utf8',
)
assert.ok(deskAuth.includes('assertPrincipalRole'))
assert.ok(deskAuth.includes('role'))

console.log('test-principal-claim: ok')
