import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  establishEventAccessSession,
  getEventAccessSessionStatus,
  isEventAccessUnlocked,
  lockEventAccessSession,
  resetEventAccessSessionForTests,
} from '../electron/session/eventAccessSession.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

const wizard = read('src/features/setup/SetupWizard.tsx')
const app = read('src/App.tsx')
const settingsModalSource = read('src/features/settings/SettingsModal.tsx')
const attendeeSearch = read('src/features/attendees/AttendeeSearchScreen.tsx')
const claimEdge = read('supabase/functions/desktop-claim-principal/index.ts')
const desktopApi = read('electron/cloud/desktopCloudApi.ts')
const settingsService = read('electron/settings/settingsService.ts')

// --- Setup flow state machine ---
assert.equal(wizard.includes("'connect'"), true, 'wizard has connect step')
assert.equal(wizard.includes("'setupMyEvent'"), true, 'wizard has setupMyEvent step')
assert.equal(wizard.includes("'joinExisting'"), true, 'wizard has joinExisting step')
assert.equal(wizard.includes("'foxbridgeSync'"), false, 'no foxbridgeSync step')
assert.equal(wizard.includes('FoxBridgeSyncEnrollment'), false, 'no Sync enrollment in wizard')
assert.equal(wizard.includes('setupLater'), false, 'no Set up later in wizard')
assert.equal(wizard.includes('eventConnect.title'), true, 'uses eventConnect copy')
assert.equal(wizard.includes('sync.setupMyEvent'), true, 'setup my event label')
assert.equal(wizard.includes('sync.joinExisting'), true, 'join existing label')

assert.equal(wizard.includes('principalFieldsReady'), true, 'principal field gate')
assert.equal(
  wizard.includes('disabled={isBusy || !principalFieldsReady}'),
  true,
  'connect disabled until fields ready',
)

assert.equal(wizard.includes('Do NOT prefill RegFox API key'), true, 'no key prefill comment')
assert.equal(/setApiKey\(nextSettings/.test(wizard), false, 'no apiKey hydrate')
assert.equal(/setEventId\(.*regfoxEventId/.test(wizard), false, 'no eventId hydrate')

assert.equal(wizard.includes('connectRegFox'), true, 'calls connectRegFox')
assert.equal(wizard.includes('claimFoxBridgeCloudPrincipal'), true, 'calls claim')
assert.equal(wizard.includes('ownershipRegFoxApiKey'), true, 'passes ownership key')
assert.equal(wizard.includes('ownershipRegFoxEventId'), true, 'passes ownership event id')
assert.equal(wizard.includes('needsTransferConfirmation'), true, 'transfer confirm')
assert.equal(wizard.includes("continueAfterUnlock('principal')"), true, 'principal unlock')

const joinMarker = "{step === 'joinExisting' &&"
const printerMarker = "{step === 'printer' &&"
const joinStart = wizard.indexOf(joinMarker)
const printerStart = wizard.indexOf(printerMarker)
assert.ok(joinStart >= 0, 'joinExisting UI marker')
assert.ok(printerStart > joinStart, 'printer UI after joinExisting')
const joinBlock = wizard.slice(joinStart, printerStart)
assert.equal(wizard.includes('redeemFoxBridgeLinkedJoin'), true, 'join redeems code')
assert.equal(joinBlock.includes('joinCode'), true, 'join code field')
assert.equal(joinBlock.includes('handleLinkedJoin'), true, 'join calls handler')
assert.equal(joinBlock.includes('apiKey'), false, 'no apiKey on join step')
assert.equal(joinBlock.includes('regfox.apiKey'), false, 'no RegFox key on join step')
assert.equal(wizard.includes("continueAfterUnlock('linked')"), true, 'linked unlock')

// --- Stale connection error is cleared on retry / success ---
const principalFn = wizard.slice(
  wizard.indexOf('const handlePrincipalUnlock'),
  wizard.indexOf('const handleLinkedJoin'),
)
const linkedFn = wizard.slice(
  wizard.indexOf('const handleLinkedJoin'),
  wizard.indexOf('const handlePrinterContinue'),
)
const setupMyEventUi = wizard.slice(
  wizard.indexOf("{step === 'setupMyEvent' &&"),
  wizard.indexOf("{step === 'joinExisting' &&"),
)

assert.ok(
  principalFn.indexOf('setError(null)') <
    principalFn.indexOf('window.electronAPI.connectRegFox({'),
  'principal clears prior error before Connect starts',
)
assert.ok(
  principalFn.indexOf('setError(null)') < principalFn.indexOf('setIsBusy(true)'),
  'principal clears error before busy/retry work',
)
assert.ok(
  setupMyEventUi.includes('setError(null)') &&
    setupMyEventUi.includes('void handlePrincipalUnlock(false)'),
  'Connect click clears visible error immediately',
)
assert.ok(
  principalFn.indexOf('setError(null)') <
    principalFn.indexOf("continueAfterUnlock('principal')") &&
    principalFn.lastIndexOf('setError(null)') >
      principalFn.indexOf('claimFoxBridgeCloudPrincipal({'),
  'principal clears error after successful claim',
)
assert.ok(
  /if \(!connectResult\.success\)[\s\S]*setError\(connectResult\.message/.test(principalFn),
  'new RegFox failure still displays its error',
)
assert.ok(
  /if \(!claimResult\.success\)[\s\S]*setError\(claimResult\.message/.test(principalFn),
  'new Cloud claim failure still displays its error',
)
assert.equal(
  setupMyEventUi.includes('{error && !isBusy && ('),
  true,
  'principal error hidden while retry is in progress',
)
assert.ok(
  principalFn.indexOf('setAttendeeCount') > principalFn.indexOf('setError(null)') &&
    principalFn.includes('connectResult.attendeeCount'),
  'successful RegFox connection clears error before claim',
)

assert.ok(
  linkedFn.indexOf('setError(null)') <
    linkedFn.indexOf('window.electronAPI.redeemFoxBridgeLinkedJoin({'),
  'linked clears prior error before join starts',
)
assert.ok(
  joinBlock.includes('setError(null)') && joinBlock.includes('void handleLinkedJoin()'),
  'Join click clears visible error immediately',
)
assert.ok(
  linkedFn.lastIndexOf('setError(null)') < linkedFn.indexOf("continueAfterUnlock('linked')") &&
    linkedFn.lastIndexOf('setError(null)') > linkedFn.indexOf('if (!result.success)'),
  'linked clears error on successful join',
)
assert.ok(
  /if \(!result\.success\)[\s\S]*setError\(result\.message/.test(linkedFn),
  'new Linked failure still displays its error',
)
assert.equal(
  joinBlock.includes('{error && !isBusy && ('),
  true,
  'linked error hidden while retry is in progress',
)

assert.equal(wizard.includes("unlockPath === 'linked'"), true, 'linked printer branch')
assert.equal(wizard.includes("setStep('mobile')"), true, 'principal can reach mobile')
assert.equal(wizard.includes('returningUser'), true, 'returningUser support')
assert.equal(wizard.includes("returningUser ? 'connect' : 'welcome'"), true, 'returning starts at connect')

// --- App routing / no Operations flash ---
assert.equal(app.includes('eventLocked'), true, 'app tracks eventLocked')
assert.equal(app.includes('getEventAccessStatus'), true, 'app reads session status')
assert.equal(app.includes('eventLocked || !setupComplete || forceSetup'), true, 'lock gates Operations')
assert.equal(app.includes('lockEventAccess'), true, 'app can lock session')
assert.equal(app.includes('returningUser={setupComplete}'), true, 'returningUser from setupComplete')
assert.equal(
  /const \[eventLocked, setEventLocked\] = useState\(true\)/.test(app),
  true,
  'assume locked until status resolves',
)

// --- Reopen Setup confirm + lock ---
assert.equal(settingsModalSource.includes('lockConfirmOpen'), true, 'confirm dialog state')
assert.equal(
  settingsModalSource.includes("t('settings.lockEventTitle')"),
  true,
  'lock title',
)
assert.equal(
  settingsModalSource.includes("t('settings.lockEventConfirm')"),
  true,
  'lock confirm button',
)
assert.equal(
  settingsModalSource.includes("t('settings.lockEventCancel')"),
  true,
  'lock cancel button',
)
assert.equal(settingsModalSource.includes('setLockConfirmOpen(true)'), true, 'opens confirm')
assert.equal(settingsModalSource.includes('setLockConfirmOpen(false)'), true, 'cancel confirm')
assert.equal(settingsModalSource.includes('onReopenSetup()'), true, 'confirm calls reopen')
assert.equal(
  /await window\.electronAPI\.resetSetup/.test(attendeeSearch),
  false,
  'reopen does not call resetSetup',
)
assert.equal(attendeeSearch.includes('onReopenSetup()'), true, 'reopen notifies parent')

// Lock clears session only (unit)
resetEventAccessSessionForTests()
establishEventAccessSession({
  eventId: 'event-1',
  conferenceId: 'conf-1',
  unlockMethod: 'principal',
})
assert.equal(isEventAccessUnlocked(), true)
lockEventAccessSession()
assert.equal(isEventAccessUnlocked(), false)
assert.equal(getEventAccessSessionStatus().locked, true)

// --- Same-installation Principal reactivation ---
assert.equal(claimEdge.includes('reactivateDeskToken'), true, 'edge reactivation')
assert.equal(claimEdge.includes('principal_reactivated'), true, 'audit reactivation')
assert.equal(desktopApi.includes('reactivateDeskToken'), true, 'desktop sends token')
assert.equal(desktopApi.includes('selectReactivateDeskToken'), true, 'uses reactivation helper')
assert.equal(desktopApi.includes('principalCredentialPersistedMatches'), true, 'verifies persist')
assert.equal(
  /existingDesk\?\.role === 'principal'/.test(desktopApi),
  false,
  'reactivation offer must not require local role===principal only',
)

const connectFn = settingsService.slice(
  settingsService.indexOf('export async function connectRegFox'),
  settingsService.indexOf('export async function loadRegFoxAttendees'),
)
assert.equal(connectFn.includes('establishEventAccessSession'), false, 'connect does not unlock')
assert.equal(settingsService.includes("unlockMethod: 'principal'"), true, 'claim unlocks principal')
assert.equal(settingsService.includes("unlockMethod: 'linked'"), true, 'redeem unlocks linked')

console.log('test-setup-wizard-event-connection: ok')
