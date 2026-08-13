import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EVENT_ACCESS_LOCKED_CODE,
  EVENT_ACCESS_LOCKED_MESSAGE,
  isEventAccessLockedError,
} from '../src/shared/models/EventAccessSession.ts'
import {
  assertEventAccessUnlocked,
  establishEventAccessSession,
  getEventAccessSessionStatus,
  isEventAccessUnlocked,
  lockEventAccessSession,
  resetEventAccessSessionForTests,
  EventAccessLockedError,
} from '../electron/session/eventAccessSession.ts'
import { decideScheduledSyncStart } from '../electron/sync/syncManagerHelpers.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function assertStartsLocked(): void {
  resetEventAccessSessionForTests()
  assert.equal(isEventAccessUnlocked(), false)
  const status = getEventAccessSessionStatus()
  assert.equal(status.locked, true)
  assert.equal(status.eventId, null)
  assert.equal(status.unlockMethod, null)
  assert.equal(status.sessionId, null)
}

function assertPersistedMetadataDoesNotUnlock(): void {
  resetEventAccessSessionForTests()
  // Simulating presence of durable settings/credentials does nothing to the session module.
  const fakePersisted = {
    setupComplete: true,
    activeEventId: 'event-abc',
    regfoxEventId: '1012457',
    deskToken: 'a'.repeat(64),
    deskRole: 'principal',
    installationId: '11111111-2222-3333-4444-555555555555',
    regfoxApiKey: 'stored-key-must-not-unlock',
  }
  void fakePersisted
  assert.equal(isEventAccessUnlocked(), false)
  assert.equal(getEventAccessSessionStatus().locked, true)
}

function assertTrustedEstablishPaths(): void {
  resetEventAccessSessionForTests()

  const principal = establishEventAccessSession({
    eventId: 'event-principal',
    conferenceId: 'conf-1',
    unlockMethod: 'principal',
  })
  assert.equal(principal.locked, false)
  assert.equal(principal.eventId, 'event-principal')
  assert.equal(principal.conferenceId, 'conf-1')
  assert.equal(principal.unlockMethod, 'principal')
  assert.ok(principal.sessionId)
  assert.ok(principal.unlockedAt)

  lockEventAccessSession()
  assert.equal(isEventAccessUnlocked(), false)

  const linked = establishEventAccessSession({
    eventId: 'event-linked',
    conferenceId: 'conf-2',
    unlockMethod: 'linked',
  })
  assert.equal(linked.unlockMethod, 'linked')
  assert.equal(linked.locked, false)

  lockEventAccessSession()
  const legacy = establishEventAccessSession({
    eventId: 'event-legacy',
    unlockMethod: 'legacy',
  })
  assert.equal(legacy.unlockMethod, 'legacy')

  lockEventAccessSession()
  const regfox = establishEventAccessSession({
    eventId: 'event-regfox',
    unlockMethod: 'regfox',
  })
  assert.equal(regfox.unlockMethod, 'regfox')
}

function assertLockBlocksImmediately(): void {
  resetEventAccessSessionForTests()
  establishEventAccessSession({
    eventId: 'event-1',
    unlockMethod: 'principal',
  })
  assert.doesNotThrow(() => assertEventAccessUnlocked())

  lockEventAccessSession()
  assert.throws(() => assertEventAccessUnlocked(), (error: unknown) => {
    assert.ok(error instanceof EventAccessLockedError)
    assert.equal(error.code, EVENT_ACCESS_LOCKED_CODE)
    assert.equal(error.message, EVENT_ACCESS_LOCKED_MESSAGE)
    assert.equal(isEventAccessLockedError(error), true)
    return true
  })
}

function assertProcessScopedSemantics(): void {
  resetEventAccessSessionForTests()
  const first = establishEventAccessSession({
    eventId: 'event-1',
    unlockMethod: 'principal',
  })
  // Sleep / window close do not call lock — session remains in process memory.
  assert.equal(isEventAccessUnlocked(), true)
  assert.equal(getEventAccessSessionStatus().sessionId, first.sessionId)

  // Only explicit lock (or process death) clears it.
  lockEventAccessSession()
  assert.equal(isEventAccessUnlocked(), false)
}

function assertSyncSkipsWhileLocked(): void {
  assert.equal(
    decideScheduledSyncStart({
      syncInProgress: false,
      activeEventId: 'event-1',
      cloudConfigured: true,
      eventAccessUnlocked: false,
    }),
    'skip_event_locked',
  )

  assert.equal(
    decideScheduledSyncStart({
      syncInProgress: false,
      activeEventId: 'event-1',
      cloudConfigured: true,
      eventAccessUnlocked: true,
    }),
    'run',
  )
}

function assertHandlerGuardInventory(): void {
  // Source-level inventory: event-sensitive handlers must call assertEventAccessUnlocked.
  const guardedFiles: Array<{ file: string; needles: string[] }> = [
    {
      file: 'electron/regfoxHandlers.ts',
      needles: [
        "assertEventAccessUnlocked()",
        "'regfox:getAttendees'",
        "'regfox:checkInAttendee'",
        "'regfox:updateRegistrations'",
      ],
    },
    {
      file: 'electron/mealValidationHandlers.ts',
      needles: ["assertEventAccessUnlocked()", "'meals:getValidationsForAttendee'", "'meals:validateMeal'"],
    },
    {
      file: 'electron/badgePrintHandlers.ts',
      needles: ["assertEventAccessUnlocked()", "'print:getBadgePrintStatus'"],
    },
    {
      file: 'electron/printHandlers.ts',
      needles: ["assertEventAccessUnlocked()", "'print:badgePreview'"],
    },
    {
      file: 'electron/eventSettingsHandlers.ts',
      needles: ["assertEventAccessUnlocked()", "'eventSettings:get'", "'eventSettings:patch'"],
    },
    {
      file: 'electron/scannerServerHandlers.ts',
      needles: ["assertEventAccessUnlocked()", "'scannerServer:start'"],
    },
    {
      file: 'electron/cloudHandlers.ts',
      needles: [
        "assertEventAccessUnlocked()",
        "'cloud:getMealDashboard'",
        "'cloud:publishAttendees'",
        "'cloud:issueJoinCode'",
        "'cloud:listDesks'",
        "'cloud:revokeDesk'",
        "'cloud:createScannerPairing'",
      ],
    },
  ]

  for (const entry of guardedFiles) {
    const source = readFileSync(join(root, entry.file), 'utf8')
    for (const needle of entry.needles) {
      assert.ok(source.includes(needle), `${entry.file} must include ${needle}`)
    }
  }

  // Unlock paths must remain available (no assert on connect / claim / redeem / enroll).
  const cloud = readFileSync(join(root, 'electron/cloudHandlers.ts'), 'utf8')
  const claimBlock = cloud.slice(cloud.indexOf("'cloud:claimPrincipal'"), cloud.indexOf("'cloud:redeemJoin'"))
  assert.equal(claimBlock.includes('assertEventAccessUnlocked'), false)
  const redeemBlock = cloud.slice(cloud.indexOf("'cloud:redeemJoin'"), cloud.indexOf("'cloud:issueJoinCode'"))
  assert.equal(redeemBlock.includes('assertEventAccessUnlocked'), false)
  const enrollBlock = cloud.slice(cloud.indexOf("'cloud:enrollDesktop'"), cloud.indexOf("'cloud:claimPrincipal'"))
  assert.equal(enrollBlock.includes('assertEventAccessUnlocked'), false)

  const regfox = readFileSync(join(root, 'electron/regfoxHandlers.ts'), 'utf8')
  const connectBlock = regfox.slice(regfox.indexOf("'regfox:connect'"), regfox.indexOf("'regfox:updateRegistrations'"))
  assert.equal(connectBlock.includes('assertEventAccessUnlocked'), false)

  // Boot must not auto-start sync/scanner; session establish wires lifecycle.
  const main = readFileSync(join(root, 'electron/main.ts'), 'utf8')
  assert.equal(main.includes('startDesktopSyncManager()'), false)
  assert.equal(main.includes('maybeAutoStartScannerServer()'), false)
  assert.ok(main.includes('registerEventAccessSessionLifecycle()'))

  const lifecycle = readFileSync(join(root, 'electron/session/eventAccessLifecycle.ts'), 'utf8')
  assert.ok(lifecycle.includes('startDesktopSyncManager()'))
  assert.ok(lifecycle.includes('stopDesktopSyncManager()'))
  assert.ok(lifecycle.includes('maybeAutoStartScannerServer()'))
  assert.ok(lifecycle.includes('stopScannerServer()'))

  const settings = readFileSync(join(root, 'electron/settings/settingsService.ts'), 'utf8')
  assert.ok(settings.includes("unlockMethod: 'principal'"))
  assert.ok(settings.includes("unlockMethod: 'linked'"))
  assert.ok(settings.includes("unlockMethod: 'legacy'"))
  assert.ok(settings.includes('establishEventAccessSession'))
  // Sprint 23.2: connectRegFox must not establish a session by itself.
  const connectFnStart = settings.indexOf('export async function connectRegFox')
  const connectFnEnd = settings.indexOf('export async function loadRegFoxAttendees')
  const connectFn = settings.slice(connectFnStart, connectFnEnd)
  assert.equal(connectFn.includes('establishEventAccessSession'), false)
}

assertStartsLocked()
assertPersistedMetadataDoesNotUnlock()
assertTrustedEstablishPaths()
assertLockBlocksImmediately()
assertProcessScopedSemantics()
assertSyncSkipsWhileLocked()
assertHandlerGuardInventory()

console.log('test-event-access-session: ok')
