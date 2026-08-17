import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { ProgressInfo, UpdateInfo } from 'electron-updater'
import type { UpdateStatus } from '../../src/shared/models/UpdateStatus'
import { notifyUpdateStatusChanged } from '../ui/notifyUpdateStatusChanged'
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
} from '../../src/shared/update/updateManagerHelpers'

let initialized = false
let listenersAttached = false
let startupTimer: ReturnType<typeof setTimeout> | null = null
let periodicTimer: ReturnType<typeof setInterval> | null = null
let checkInFlight = false
let status: UpdateStatus = createDisabledUpdateStatus('0.0.0')

function publishStatus(next: UpdateStatus): void {
  status = next
  notifyUpdateStatusChanged(status)
}

export function getUpdateStatus(): UpdateStatus {
  return { ...status }
}

function logUpdateError(context: string, error: unknown): void {
  console.warn(`[update] ${context}:`, formatUpdateErrorForLog(error))
}

function configureAutoUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
}

function attachAutoUpdaterListeners(): void {
  if (listenersAttached) {
    return
  }
  listenersAttached = true

  autoUpdater.on('checking-for-update', () => {
    publishStatus(applyCheckingStatus(status))
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const version = info.version?.trim()
    if (!version) {
      return
    }
    publishStatus(
      applyAvailableStatus(status, version, new Date().toISOString()),
    )
  })

  autoUpdater.on('update-not-available', () => {
    publishStatus(applyUpToDateStatus(status, new Date().toISOString()))
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    publishStatus(
      applyDownloadingStatus(status, clampDownloadPercent(progress.percent)),
    )
  })

  autoUpdater.on('update-downloaded', (event) => {
    publishStatus(
      applyDownloadedStatus(status, event.version?.trim() ?? status.availableVersion),
    )
  })

  autoUpdater.on('error', (error: Error) => {
    logUpdateError('autoUpdater error', error)
    publishStatus(applyErrorStatus(status, normalizeUpdateError(error)))
  })
}

async function runCheckForUpdates(): Promise<UpdateStatus> {
  if (!status.updaterEnabled) {
    return getUpdateStatus()
  }

  if (checkInFlight || shouldSkipScheduledCheck(status.state)) {
    return getUpdateStatus()
  }

  checkInFlight = true
  publishStatus(applyCheckingStatus(status))

  try {
    const result = await autoUpdater.checkForUpdates()
    if (status.state === 'checking') {
      const remoteVersion = result?.updateInfo?.version?.trim()
      if (remoteVersion && remoteVersion !== status.currentVersion) {
        publishStatus(
          applyAvailableStatus(status, remoteVersion, new Date().toISOString()),
        )
      } else {
        publishStatus(applyUpToDateStatus(status, new Date().toISOString()))
      }
    }
    return getUpdateStatus()
  } catch (error) {
    logUpdateError('checkForUpdates failed', error)
    publishStatus(
      applyErrorStatus(status, normalizeUpdateError(error)),
    )
    return getUpdateStatus()
  } finally {
    checkInFlight = false
  }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  return runCheckForUpdates()
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  if (!canDownloadUpdate(status.state, status.updaterEnabled)) {
    return getUpdateStatus()
  }

  publishStatus(applyDownloadingStatus(status, 0))

  try {
    await autoUpdater.downloadUpdate()
    if (status.state === 'downloading') {
      publishStatus(
        applyDownloadedStatus(status, status.availableVersion),
      )
    }
    return getUpdateStatus()
  } catch (error) {
    logUpdateError('downloadUpdate failed', error)
    publishStatus(applyErrorStatus(status, normalizeUpdateError(error)))
    return getUpdateStatus()
  }
}

export function restartAndInstallUpdate(): UpdateStatus {
  if (!canRestartAndInstall(status.state, status.updaterEnabled)) {
    return getUpdateStatus()
  }

  autoUpdater.quitAndInstall()
  return getUpdateStatus()
}

export function initializeUpdateManager(): void {
  if (initialized) {
    return
  }
  initialized = true

  const currentVersion = app.getVersion()

  if (!app.isPackaged) {
    status = createDisabledUpdateStatus(currentVersion)
    return
  }

  status = createIdleUpdateStatus(currentVersion)
  configureAutoUpdater()
  attachAutoUpdaterListeners()

  startupTimer = setTimeout(() => {
    void runCheckForUpdates()
  }, UPDATE_STARTUP_DELAY_MS)
  startupTimer.unref?.()

  periodicTimer = setInterval(() => {
    void runCheckForUpdates()
  }, UPDATE_PERIODIC_INTERVAL_MS)
  periodicTimer.unref?.()
}

export function stopUpdateManager(): void {
  if (startupTimer) {
    clearTimeout(startupTimer)
    startupTimer = null
  }
  if (periodicTimer) {
    clearInterval(periodicTimer)
    periodicTimer = null
  }
  initialized = false
}
