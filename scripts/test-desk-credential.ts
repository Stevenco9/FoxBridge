import assert from 'node:assert/strict'
import {
  isConferenceAuthorizedForDesk,
  isEnrollmentTtlMinutesValid,
  normalizeEnrollmentCode,
  resolveCloudOpsTransport,
} from '../src/shared/cloud/deskCredentialPolicy.ts'

assert.equal(
  resolveCloudOpsTransport({
    publicConfigured: false,
    deskTokenPresent: true,
    legacyPrivilegedKeyPresent: true,
  }),
  'none',
)

assert.equal(
  resolveCloudOpsTransport({
    publicConfigured: true,
    deskTokenPresent: true,
    legacyPrivilegedKeyPresent: true,
  }),
  'desk_credential',
)

assert.equal(
  resolveCloudOpsTransport({
    publicConfigured: true,
    deskTokenPresent: false,
    legacyPrivilegedKeyPresent: true,
  }),
  'legacy_service_role',
)

assert.equal(
  resolveCloudOpsTransport({
    publicConfigured: true,
    deskTokenPresent: false,
    legacyPrivilegedKeyPresent: false,
  }),
  'none',
)

assert.equal(normalizeEnrollmentCode(' abcd-efgh-ijkl '), 'ABCD-EFGH-IJKL')
assert.equal(isEnrollmentTtlMinutesValid(60), true)
assert.equal(isEnrollmentTtlMinutesValid(4), false)
assert.equal(isEnrollmentTtlMinutesValid(24 * 60 + 1), false)

assert.equal(
  isConferenceAuthorizedForDesk({
    deskConferenceId: 'conf-a',
    requestedConferenceId: null,
  }),
  true,
)

assert.equal(
  isConferenceAuthorizedForDesk({
    deskConferenceId: 'conf-a',
    requestedConferenceId: 'conf-a',
  }),
  true,
)

assert.equal(
  isConferenceAuthorizedForDesk({
    deskConferenceId: 'conf-a',
    requestedConferenceId: 'conf-b',
  }),
  false,
)

console.log('test-desk-credential: ok')
