/**
 * Sprint 21.9 — automated Sync deployment readiness checks.
 *
 * These assertions verify repo packaging + schema readiness.
 * They do NOT replace a live Cloud E2E run against a deployed project.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- Migrations present ---
const migrationsDir = join(root, 'supabase/migrations')
const migrationFiles = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()
const requiredMigrations = [
  '001_cloud_foundation.sql',
  '002_mobile_scanner_foundation.sql',
  '003_mobile_attendee_lookup.sql',
  '004_mobile_meal_validation.sql',
  '005_scanner_pairing_tokens.sql',
  '007_fix_validate_meal_ambiguous.sql',
  '008_fix_pairing_token_digest.sql',
  '009_desk_devices.sql',
  '010_fix_issue_desk_enrollment_digest.sql',
  '011_principal_desk_provisioning.sql',
  '016_operational_attendee_snapshot.sql',
  '017_conference_attendee_check_ins.sql',
  '018_upstream_check_in_retry_metadata.sql',
  '019_conference_attendee_check_in_audit.sql',
]

for (const name of requiredMigrations) {
  assert.ok(migrationFiles.includes(name), `missing migration ${name}`)
}

// --- Migration 010 fixes search_path for enrollment code issuance ---
const migration010 = read('supabase/migrations/010_fix_issue_desk_enrollment_digest.sql')
assert.ok(migration010.includes('issue_desk_enrollment_code'))
assert.ok(
  /SET\s+search_path\s*=\s*public\s*,\s*extensions/i.test(migration010),
  'migration 010 must set search_path = public, extensions',
)
assert.ok(migration010.includes('digest('))
assert.ok(migration010.includes('gen_random_bytes('))

// Ensure 009 still documents the original bug class (public-only path).
const migration009 = read('supabase/migrations/009_desk_devices.sql')
assert.match(migration009, /SET\s+search_path\s*=\s*public\s*$/m)

// Pairing fix from 008 remains the reference pattern.
const migration008 = read('supabase/migrations/008_fix_pairing_token_digest.sql')
assert.ok(/SET\s+search_path\s*=\s*public\s*,\s*extensions/i.test(migration008))

// --- Edge Functions required for production Sync ---
const requiredFunctions = [
  'desktop-enroll',
  'desktop-claim-principal',
  'desktop-resolve-conference',
  'desktop-publish',
  'desktop-pull-attendees',
  'desktop-check-in',
  'desktop-pull-check-ins',
  'desktop-pull-pending-check-ins',
  'desktop-update-check-in-upstream-status',
  'desktop-upstream-check-in-health',
  'desktop-create-pairing',
  'desktop-pairing-status',
  'desktop-ensure-scanner-session',
]
for (const name of requiredFunctions) {
  assert.ok(
    existsSync(join(root, `supabase/functions/${name}/index.ts`)),
    `missing Edge Function ${name}`,
  )
}
assert.ok(existsSync(join(root, 'supabase/functions/_shared/deskAuth.ts')))

// --- Packaged Desktop must not define service-role ---
const viteConfig = read('vite.config.ts')
assert.ok(viteConfig.includes('FOXBRIDGE_CLOUD_URL'))
assert.ok(viteConfig.includes('FOXBRIDGE_CLOUD_PUBLISHABLE_KEY'))
assert.ok(viteConfig.includes('FOXBRIDGE_SCANNER_URL'))
assert.equal(viteConfig.includes('SERVICE_ROLE'), false)
assert.equal(viteConfig.includes('SUPABASE_SERVICE_ROLE_KEY'), false)

const appDefaults = read('electron/config/appDefaults.ts')
assert.ok(appDefaults.includes('FOXBRIDGE_CLOUD_URL'))
assert.ok(appDefaults.toLowerCase().includes('never put a service-role'))

// electron-builder must not ship root .env
const packageJson = JSON.parse(read('package.json')) as {
  build?: { files?: string[] }
}
const builderFiles = packageJson.build?.files ?? []
assert.ok(builderFiles.some((entry) => entry.includes('dist-electron')))
assert.equal(
  builderFiles.some((entry) => entry === '.env' || entry.includes('.env')),
  false,
  'electron-builder must not package .env',
)

// --- Mobile public-only env example ---
const mobileEnvExample = read('apps/mobile/.env.example')
assert.ok(mobileEnvExample.includes('VITE_SUPABASE_URL'))
assert.ok(mobileEnvExample.includes('VITE_SUPABASE_ANON_KEY'))
assert.equal(mobileEnvExample.includes('SERVICE_ROLE'), false)

// --- Failure/recovery helpers remain non-technical ---
const statusHelpers = read('src/shared/sync/foxbridgeSyncStatus.ts')
assert.ok(statusHelpers.includes('expired_code'))
assert.ok(statusHelpers.includes('invalid_code'))
assert.ok(statusHelpers.includes('revoked'))
assert.ok(statusHelpers.includes('needs_reenrollment'))

console.log('test-sync-deployment-readiness: ok')
console.log(
  'NOTE: Live Cloud E2E (enroll → pair → validate → Desktop pull) still requires manual validation against a deployed project.',
)
