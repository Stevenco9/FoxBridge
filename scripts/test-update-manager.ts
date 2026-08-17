import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  UPDATE_PERIODIC_INTERVAL_MS,
  UPDATE_STARTUP_DELAY_MS,
  applyAvailableStatus,
  applyCheckingStatus,
  applyDownloadedStatus,
  applyDownloadingStatus,
  applyErrorStatus,
  applyUpToDateStatus,
  canDownloadUpdate,
  canRestartAndInstall,
  clampDownloadPercent,
  createDisabledUpdateStatus,
  createIdleUpdateStatus,
  formatUpdateErrorForLog,
  normalizeUpdateError,
  shouldSkipScheduledCheck,
} from '../src/shared/update/updateManagerHelpers.ts'

const root = join(import.meta.dirname, '..')

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

// --- timing policy ---
assert.ok(UPDATE_STARTUP_DELAY_MS >= 30_000 && UPDATE_STARTUP_DELAY_MS <= 60_000)
assert.ok(UPDATE_PERIODIC_INTERVAL_MS >= 4 * 60 * 60 * 1000)
assert.ok(UPDATE_PERIODIC_INTERVAL_MS <= 6 * 60 * 60 * 1000)

// --- packaged-only enablement / dev disabled ---
const disabled = createDisabledUpdateStatus('0.1.2')
assert.equal(disabled.updaterEnabled, false)
assert.equal(disabled.state, 'idle')
assert.equal(disabled.currentVersion, '0.1.2')
assert.equal(disabled.availableVersion, null)

const idle = createIdleUpdateStatus('0.1.2')
assert.equal(idle.updaterEnabled, true)
assert.equal(idle.state, 'idle')

// --- initial status shape ---
for (const status of [disabled, idle]) {
  assert.equal(status.downloadPercent, null)
  assert.equal(status.errorSafeMessage, null)
  assert.equal(status.lastCheckedAt, null)
}

// --- mocked autoUpdater event flow via pure helpers ---
let status = createIdleUpdateStatus('0.1.2')

status = applyCheckingStatus(status)
assert.equal(status.state, 'checking')
assert.equal(status.errorSafeMessage, null)

status = applyAvailableStatus(status, '0.1.3', '2026-08-17T00:00:00.000Z')
assert.equal(status.state, 'available')
assert.equal(status.availableVersion, '0.1.3')
assert.equal(status.lastCheckedAt, '2026-08-17T00:00:00.000Z')

status = applyDownloadingStatus(status, 42)
assert.equal(status.state, 'downloading')
assert.equal(status.downloadPercent, 42)

status = applyDownloadedStatus(status, '0.1.3')
assert.equal(status.state, 'downloaded')
assert.equal(status.downloadPercent, 100)

status = createIdleUpdateStatus('0.1.2')
status = applyCheckingStatus(status)
status = applyUpToDateStatus(status, '2026-08-17T01:00:00.000Z')
assert.equal(status.state, 'upToDate')
assert.equal(status.availableVersion, null)

status = applyCheckingStatus(status)
status = applyErrorStatus(status, normalizeUpdateError(new Error('ENOTFOUND github.com')))
assert.equal(status.state, 'error')
assert.match(status.errorSafeMessage ?? '', /internet connection/i)

// --- download progress ---
assert.equal(clampDownloadPercent(-5), 0)
assert.equal(clampDownloadPercent(0), 0)
assert.equal(clampDownloadPercent(50.4), 50)
assert.equal(clampDownloadPercent(100), 100)
assert.equal(clampDownloadPercent(150), 100)
assert.equal(clampDownloadPercent(undefined), null)
assert.equal(clampDownloadPercent(Number.NaN), null)

// --- guards ---
assert.equal(canDownloadUpdate('available', true), true)
assert.equal(canDownloadUpdate('available', false), false)
assert.equal(canDownloadUpdate('checking', true), false)
assert.equal(canDownloadUpdate('downloading', true), false)
assert.equal(canDownloadUpdate('downloaded', true), false)

assert.equal(canRestartAndInstall('downloaded', true), true)
assert.equal(canRestartAndInstall('downloaded', false), false)
assert.equal(canRestartAndInstall('available', true), false)
assert.equal(canRestartAndInstall('downloading', true), false)

assert.equal(shouldSkipScheduledCheck('checking'), true)
assert.equal(shouldSkipScheduledCheck('downloading'), true)
assert.equal(shouldSkipScheduledCheck('available'), false)
assert.equal(shouldSkipScheduledCheck('idle'), false)

// --- error normalization ---
assert.match(
  normalizeUpdateError(new Error('getaddrinfo ENOTFOUND api.github.com')),
  /internet connection/i,
)
assert.match(
  normalizeUpdateError(new Error('404 latest-mac.yml not found')),
  /No update is available/i,
)
assert.match(
  normalizeUpdateError(new Error('sha512 checksum mismatch')),
  /could not be verified/i,
)
assert.match(
  normalizeUpdateError(new Error('download failed: aborted')),
  /download did not complete/i,
)
assert.match(
  normalizeUpdateError(new Error('401 Unauthorized')),
  /Unable to reach the update service/i,
)
assert.match(
  normalizeUpdateError(new Error('quitAndInstall not ready')),
  /not ready to install/i,
)
assert.match(normalizeUpdateError(new Error('something weird')), /Unable to check for updates/i)

const redacted = formatUpdateErrorForLog(
  new Error('Bearer ghp_secret123 password=supersecret sb_publishable_abc'),
)
assert.doesNotMatch(redacted, /ghp_secret123/)
assert.doesNotMatch(redacted, /supersecret/)
assert.match(redacted, /\[redacted\]/)

// --- wiring: packaged-only startup + periodic checks ---
const updateManagerSource = readSource('electron/update/updateManager.ts')
assert.match(updateManagerSource, /autoUpdater\.autoDownload\s*=\s*false/)
assert.match(updateManagerSource, /autoUpdater\.autoInstallOnAppQuit\s*=\s*false/)
assert.match(updateManagerSource, /if\s*\(!app\.isPackaged\)/)
assert.match(updateManagerSource, /UPDATE_STARTUP_DELAY_MS/)
assert.match(updateManagerSource, /UPDATE_PERIODIC_INTERVAL_MS/)
assert.match(updateManagerSource, /setTimeout/)
assert.match(updateManagerSource, /setInterval/)
assert.match(updateManagerSource, /quitAndInstall/)
assert.doesNotMatch(updateManagerSource, /setFeedURL/)
assert.doesNotMatch(updateManagerSource, /GH_TOKEN|github\.token|private:\s*true/i)

const updateHandlersSource = readSource('electron/update/updateHandlers.ts')
assert.match(updateHandlersSource, /update:getStatus/)
assert.match(updateHandlersSource, /update:checkForUpdates/)
assert.match(updateHandlersSource, /update:downloadUpdate/)
assert.match(updateHandlersSource, /update:restartAndInstallUpdate/)
assert.doesNotMatch(updateHandlersSource, /setFeedURL|GH_TOKEN|ipcMain\.handle\([^)]*url/i)

const mainSource = readSource('electron/main.ts')
assert.match(mainSource, /registerUpdateHandlers/)
assert.match(mainSource, /initializeUpdateManager/)
assert.match(mainSource, /stopUpdateManager/)
assert.doesNotMatch(mainSource, /EventAccessSession.*update|update.*EventAccessSession/i)

const preloadSource = readSource('electron/preload.ts')
assert.match(preloadSource, /getUpdateStatus/)
assert.match(preloadSource, /checkForUpdates/)
assert.match(preloadSource, /downloadUpdate/)
assert.match(preloadSource, /restartAndInstallUpdate/)
assert.match(preloadSource, /onUpdateStatusChanged/)
assert.match(preloadSource, /removeListener\('update:statusChanged'/)
assert.doesNotMatch(preloadSource, /setFeedURL|GH_TOKEN|update:.*url/i)

const notifySource = readSource('electron/ui/notifyUpdateStatusChanged.ts')
assert.match(notifySource, /update:statusChanged/)

const viteConfig = readSource('vite.config.ts')
assert.match(viteConfig, /'electron-updater'/)

const packageJson = readSource('package.json')
assert.match(packageJson, /"electron-updater"/)
assert.match(packageJson, /"name":\s*"foxbridge"/)
assert.doesNotMatch(packageJson, /"version":\s*"0\.1\.3"/)

console.log('test-update-manager: ok')
