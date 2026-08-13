/**
 * Sprint 23.5b2 — audit + Principal upstream health (static + unit).
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatUpstreamCheckInHealthMessage,
  resolveUpstreamCheckInHealthLevel,
  UPSTREAM_SOFT_PENDING_THRESHOLD_MS,
} from '../src/shared/sync/upstreamCheckInHealth.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- Migration 019 ---
assert.ok(existsSync(join(root, 'supabase/migrations/019_conference_attendee_check_in_audit.sql')))
const m019 = read('supabase/migrations/019_conference_attendee_check_in_audit.sql')
assert.ok(m019.includes('conference_attendee_check_in_audit'))
assert.ok(m019.includes('attendee_checked_in'))
assert.ok(m019.includes('attendee_check_in_duplicate'))
assert.ok(m019.includes('upstream_check_in_synced'))
assert.ok(m019.includes('upstream_check_in_failed'))
assert.ok(m019.includes('REVOKE ALL'))
assert.equal(m019.includes('upstream_check_in_retry'), false)
assert.equal(m019.toLowerCase().includes('email'), false)

assert.ok(
  readdirSync(join(root, 'supabase/migrations'))
    .filter((n) => n.endsWith('.sql'))
    .includes('019_conference_attendee_check_in_audit.sql'),
)

// --- Shared audit helper strips secrets ---
const auditHelper = read('supabase/functions/_shared/checkInAudit.ts')
assert.ok(auditHelper.includes('insertCheckInAuditBestEffort'))
assert.ok(auditHelper.includes('api_key'))
assert.ok(auditHelper.includes('token'))

// --- Check-in Edge audits without failing ops ---
const checkIn = read('supabase/functions/desktop-check-in/index.ts')
assert.ok(checkIn.includes('attendee_checked_in'))
assert.ok(checkIn.includes('attendee_check_in_duplicate'))
assert.ok(checkIn.includes('insertCheckInAuditBestEffort'))

const writeback = read('supabase/functions/desktop-update-check-in-upstream-status/index.ts')
assert.ok(writeback.includes('upstream_check_in_synced'))
assert.ok(writeback.includes('upstream_check_in_failed'))
assert.ok(writeback.includes('insertCheckInAuditBestEffort'))

// --- Health Edge Principal-only ---
assert.ok(existsSync(join(root, 'supabase/functions/desktop-upstream-check-in-health/index.ts')))
const healthEdge = read('supabase/functions/desktop-upstream-check-in-health/index.ts')
assert.ok(healthEdge.includes('assertPrincipalRole'))
assert.ok(healthEdge.includes('pending'))
assert.ok(healthEdge.includes('terminalOrExhausted'))
assert.equal(healthEdge.toLowerCase().includes('email'), false)
assert.equal(healthEdge.includes('display_name'), false)

// --- Desktop Principal gate ---
const handlers = read('electron/cloudHandlers.ts')
assert.ok(handlers.includes("role !== 'principal'"))
assert.ok(handlers.includes('getUpstreamCheckInHealth'))
assert.ok(handlers.includes('return null'))

const enrollment = read('src/features/sync/FoxBridgeSyncEnrollment.tsx')
assert.ok(enrollment.includes('getUpstreamCheckInHealth'))
assert.ok(enrollment.includes("connectedRoleLabel === 'principal'"))
assert.ok(enrollment.includes('upstreamHealthMessage'))

// --- Health presentation thresholds ---
const now = Date.parse('2026-08-13T12:00:00.000Z')
assert.equal(
  resolveUpstreamCheckInHealthLevel(
    { pending: 0, failedRetryable: 0, terminalOrExhausted: 0 },
    now,
  ),
  'healthy',
)
assert.equal(
  resolveUpstreamCheckInHealthLevel(
    {
      pending: 2,
      failedRetryable: 0,
      terminalOrExhausted: 0,
      oldestWaitingAt: new Date(now - 10_000).toISOString(),
    },
    now,
  ),
  'healthy',
)
assert.ok(UPSTREAM_SOFT_PENDING_THRESHOLD_MS >= 60_000)
assert.equal(
  resolveUpstreamCheckInHealthLevel(
    {
      pending: 3,
      failedRetryable: 0,
      terminalOrExhausted: 0,
      oldestWaitingAt: new Date(now - UPSTREAM_SOFT_PENDING_THRESHOLD_MS - 1).toISOString(),
    },
    now,
  ),
  'soft_pending',
)
assert.equal(
  resolveUpstreamCheckInHealthLevel(
    { pending: 0, failedRetryable: 1, terminalOrExhausted: 2 },
    now,
  ),
  'attention',
)

const t = (key: string, values?: Record<string, string | number>) => {
  if (key === 'sync.upstream.ok') return 'Upstream sync: OK'
  if (key === 'sync.upstream.pending') return `${values?.count} waiting`
  if (key === 'sync.upstream.attention') return `${values?.count} attention`
  return key
}
assert.equal(
  formatUpstreamCheckInHealthMessage(
    'healthy',
    { pending: 0, failedRetryable: 0, terminalOrExhausted: 0 },
    t,
  ),
  'Upstream sync: OK',
)
assert.equal(
  formatUpstreamCheckInHealthMessage(
    'soft_pending',
    { pending: 3, failedRetryable: 0, terminalOrExhausted: 0 },
    t,
  ),
  '3 waiting',
)
assert.equal(
  formatUpstreamCheckInHealthMessage(
    'attention',
    { pending: 0, failedRetryable: 0, terminalOrExhausted: 2 },
    t,
  ),
  '2 attention',
)

// Platform-neutral naming in UI strings
const messages = read('src/i18n/messages.ts')
assert.ok(messages.includes('Upstream sync: OK'))
assert.ok(messages.includes('registration sync'))
assert.equal(messages.includes('RegFox sync:'), false)

// Ops authority unchanged
assert.equal(checkIn.includes('checkInRegistrant'), false)

console.log('test-upstream-check-in-health-23-5b2: ok')
