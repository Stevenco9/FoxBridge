import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { translate } from '../src/i18n/messages.ts'
import {
  formatDownloadProgressPercent,
  isCheckForUpdatesEnabled,
  isRestartAndInstallEnabled,
  isUpdateNowEnabled,
  shouldShowSettingsUpdateBadge,
} from '../src/shared/update/updateUiHelpers.ts'

const root = join(import.meta.dirname, '..')

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- badge visibility ---
assert.equal(shouldShowSettingsUpdateBadge('idle'), false)
assert.equal(shouldShowSettingsUpdateBadge('upToDate'), false)
assert.equal(shouldShowSettingsUpdateBadge('checking'), false)
assert.equal(shouldShowSettingsUpdateBadge('downloading'), false)
assert.equal(shouldShowSettingsUpdateBadge('error'), false)
assert.equal(shouldShowSettingsUpdateBadge('available'), true)
assert.equal(shouldShowSettingsUpdateBadge('downloaded'), true)

// --- button enablement ---
assert.equal(isCheckForUpdatesEnabled('idle', true), true)
assert.equal(isCheckForUpdatesEnabled('upToDate', true), true)
assert.equal(isCheckForUpdatesEnabled('checking', true), false)
assert.equal(isCheckForUpdatesEnabled('downloading', true), false)
assert.equal(isCheckForUpdatesEnabled('idle', false), false)

assert.equal(isUpdateNowEnabled('available', true), true)
assert.equal(isUpdateNowEnabled('available', false), false)
assert.equal(isUpdateNowEnabled('downloaded', true), false)

assert.equal(isRestartAndInstallEnabled('downloaded', true), true)
assert.equal(isRestartAndInstallEnabled('downloaded', false), false)
assert.equal(isRestartAndInstallEnabled('available', true), false)

// --- download progress ---
assert.equal(formatDownloadProgressPercent(42.6), 43)
assert.equal(formatDownloadProgressPercent(150), 100)
assert.equal(formatDownloadProgressPercent(null), null)

// --- i18n coverage ---
for (const key of [
  'settings.update.title',
  'settings.update.checkForUpdates',
  'settings.update.updateNow',
  'settings.update.restartAndUpdate',
  'settings.update.tryAgain',
  'settings.update.badgeLabel',
] as const) {
  assert.ok(translate('en', key).length > 0)
  assert.ok(translate('es', key).length > 0)
}

assert.match(translate('en', 'settings.update.available', { version: '0.1.3' }), /0\.1\.3/)
assert.match(translate('es', 'settings.update.available', { version: '0.1.3' }), /0\.1\.3/)

// --- source wiring ---
const softwareUpdateSection = readSource('src/features/settings/SoftwareUpdateSection.tsx')
assert.match(softwareUpdateSection, /onCheckForUpdates/)
assert.match(softwareUpdateSection, /onDownloadUpdate/)
assert.match(softwareUpdateSection, /onRestartAndInstallUpdate/)
assert.match(softwareUpdateSection, /onRefreshUpdateStatus/)
assert.match(softwareUpdateSection, /restartConfirmOpen/)
assert.match(softwareUpdateSection, /settings\.update\./)
assert.doesNotMatch(softwareUpdateSection, /electron-updater|GitHub feed|setFeedURL|GH_TOKEN/i)

const settingsModal = readSource('src/features/settings/SettingsModal.tsx')
assert.match(settingsModal, /SoftwareUpdateSection/)
assert.match(settingsModal, /updateStatus/)

const operationsHome = readSource('src/features/operations/OperationsHome.tsx')
assert.match(operationsHome, /showSettingsUpdateBadge/)
assert.match(operationsHome, /operations-home__settings-badge/)

const attendeeScreen = readSource('src/features/attendees/AttendeeSearchScreen.tsx')
assert.match(attendeeScreen, /useUpdateStatus/)
assert.match(attendeeScreen, /shouldShowSettingsUpdateBadge/)
assert.match(attendeeScreen, /showSettingsUpdateBadge/)

const updateHook = readSource('src/hooks/useUpdateStatus.ts')
assert.match(updateHook, /getUpdateStatus/)
assert.match(updateHook, /onUpdateStatusChanged/)
assert.match(updateHook, /unsubscribe/)
assert.match(updateHook, /checkForUpdates/)
assert.match(updateHook, /downloadUpdate/)
assert.match(updateHook, /restartAndInstallUpdate/)
assert.doesNotMatch(updateHook, /setFeedURL|feedUrl|GH_TOKEN/i)

const messages = readSource('src/i18n/messages.ts')
assert.match(messages, /'settings\.update\.title'/)
assert.match(messages, /'settings\.update\.restartBody'/)

console.log('test-software-update-ui: ok')
