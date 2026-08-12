/**
 * Sprint 22.5 — redeem ambiguous conference_id regression (live Postgres 42702).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyFoxBridgeSyncIssue } from '../src/shared/sync/foxbridgeSyncStatus.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const migration015 = readFileSync(
  join(root, 'supabase/migrations/015_fix_redeem_join_ambiguous_conference_id.sql'),
  'utf8',
)
assert.ok(migration015.includes('FROM desk_devices AS d'))
assert.ok(migration015.includes('d.conference_id = v_code.conference_id'))
assert.ok(migration015.includes('d.installation_id = v_installation'))
assert.ok(migration015.includes('UPDATE desk_devices AS d'))
assert.ok(migration015.includes('UPDATE desk_join_codes AS c'))
// Must not leave unqualified WHERE conference_id = in the installation lookup
assert.equal(
  /WHERE\s+conference_id\s*=\s*v_code\.conference_id/.test(migration015),
  false,
)

const migration013 = readFileSync(
  join(root, 'supabase/migrations/013_linked_desk_installation_identity.sql'),
  'utf8',
)
// Document the buggy pattern that 015 fixes (013 historically had it)
assert.ok(migration013.includes('WHERE conference_id = v_code.conference_id'))

const redeemFn = readFileSync(
  join(root, 'supabase/functions/desktop-redeem-join/index.ts'),
  'utf8',
)
assert.ok(redeemFn.includes('ambiguous'))
assert.ok(redeemFn.includes('migration 015'))
assert.ok(redeemFn.includes('details'))

assert.equal(
  classifyFoxBridgeSyncIssue(
    'column reference "conference_id" is ambiguous',
  ),
  'invalid_code',
)
assert.equal(
  classifyFoxBridgeSyncIssue(
    'Unable to connect with that code. FoxBridge Cloud needs a Linked redeem update (migration 015).',
  ),
  'invalid_code',
)
assert.equal(
  classifyFoxBridgeSyncIssue('FoxBridge Cloud request failed (500).'),
  'cloud_unavailable',
)

console.log('test-linked-redeem-ambiguous-fix: ok')
