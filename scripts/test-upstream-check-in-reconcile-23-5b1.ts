/**
 * Sprint 23.5b1 — upstream check-in reconciliation (static + unit).
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  computeUpstreamNextAttemptAt,
  isUpstreamAttemptExhausted,
  UPSTREAM_MAX_ATTEMPTS,
} from '../electron/reconcile/upstreamCheckInTypes.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- Migration 018 durable retry ---
assert.ok(existsSync(join(root, 'supabase/migrations/018_upstream_check_in_retry_metadata.sql')))
const m018 = read('supabase/migrations/018_upstream_check_in_retry_metadata.sql')
assert.ok(m018.includes('upstream_attempt_count'))
assert.ok(m018.includes('upstream_next_attempt_at'))
assert.ok(m018.includes('upstream_retry_eligible'))
assert.equal(m018.toLowerCase().includes('regfox_'), false)

const migrations = readdirSync(join(root, 'supabase/migrations'))
  .filter((n) => n.endsWith('.sql'))
  .sort()
assert.ok(migrations.includes('018_upstream_check_in_retry_metadata.sql'))

// --- Edge Principal-only ---
assert.ok(existsSync(join(root, 'supabase/functions/desktop-pull-pending-check-ins/index.ts')))
assert.ok(
  existsSync(join(root, 'supabase/functions/desktop-update-check-in-upstream-status/index.ts')),
)
const pullPending = read('supabase/functions/desktop-pull-pending-check-ins/index.ts')
assert.ok(pullPending.includes('assertPrincipalRole'))
assert.ok(pullPending.includes('upstream_retry_eligible'))
assert.equal(pullPending.includes('checkInRegistrant'), false)

const writeback = read('supabase/functions/desktop-update-check-in-upstream-status/index.ts')
assert.ok(writeback.includes('assertPrincipalRole'))
assert.ok(writeback.includes('upstream_retry_eligible'))
assert.ok(writeback.includes('Does not modify checked_in'))
assert.ok(writeback.includes('upstream_sync_status'))
assert.equal(writeback.includes('.update({ checked_in'), false)

// --- Adapter / manager (source) ---
const registry = read('electron/reconcile/upstreamCheckInRegistry.ts')
assert.ok(registry.includes("regFoxCheckInReconciler.platformId"))
assert.ok(registry.includes('REGISTRY.get(key)'))

const regFoxAdapter = read('electron/reconcile/adapters/regFoxCheckInReconciler.ts')
assert.ok(regFoxAdapter.includes("platformId: 'regfox'"))
assert.ok(regFoxAdapter.includes('checkInRegistrant'))
assert.ok(regFoxAdapter.includes('alreadyCheckedIn'))

const manager = read('electron/reconcile/upstreamCheckInReconcilerManager.ts')
assert.ok(manager.includes('pullPendingCheckInsViaDesk'))
assert.ok(manager.includes("role === 'principal'"))
assert.ok(manager.includes('30_000'))
assert.ok(manager.includes('retry_exhausted'))
assert.ok(manager.includes('upstream_not_configured'))

const lifecycle = read('electron/session/eventAccessLifecycle.ts')
assert.ok(lifecycle.includes('startUpstreamCheckInReconcilerManager'))
assert.ok(lifecycle.includes('stopUpstreamCheckInReconcilerManager'))

const checkIn = read('electron/regfox/checkInAttendee.ts')
assert.ok(checkIn.includes('checkInAttendeeViaDesk'))
assert.ok(checkIn.includes('requestUpstreamCheckInReconcileBestEffort'))
assert.equal(checkIn.includes('createRegFoxServiceFromSettings'), false)

const refresh = read('electron/settings/settingsService.ts')
assert.ok(refresh.includes('requestCheckInSyncBestEffort'))
assert.ok(refresh.includes('requestUpstreamCheckInReconcileBestEffort'))

// Operational path still platform-agnostic
const desktopCheckIn = read('supabase/functions/desktop-check-in/index.ts')
assert.equal(desktopCheckIn.toLowerCase().includes('regfox'), false)

// --- Durable backoff helpers ---
assert.equal(isUpstreamAttemptExhausted(UPSTREAM_MAX_ATTEMPTS), true)
assert.equal(isUpstreamAttemptExhausted(UPSTREAM_MAX_ATTEMPTS - 1), false)
const next1 = Date.parse(computeUpstreamNextAttemptAt(1))
const next5 = Date.parse(computeUpstreamNextAttemptAt(5))
assert.ok(next1 > Date.now())
assert.ok(next5 >= next1)

// Terminal vs retryable writeback mapping present
assert.ok(manager.includes('failed_terminal'))
assert.ok(manager.includes('upstreamRetryEligible: false'))

console.log('test-upstream-check-in-reconcile-23-5b1: ok')
