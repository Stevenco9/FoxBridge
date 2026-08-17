import type { UpdateState } from '../models/UpdateStatus'

export function shouldShowSettingsUpdateBadge(state: UpdateState): boolean {
  return state === 'available' || state === 'downloaded'
}

export function isCheckForUpdatesEnabled(
  state: UpdateState,
  updaterEnabled: boolean,
): boolean {
  if (!updaterEnabled) {
    return false
  }
  return state !== 'checking' && state !== 'downloading'
}

export function isUpdateNowEnabled(state: UpdateState, updaterEnabled: boolean): boolean {
  return updaterEnabled && state === 'available'
}

export function isRestartAndInstallEnabled(
  state: UpdateState,
  updaterEnabled: boolean,
): boolean {
  return updaterEnabled && state === 'downloaded'
}

export function formatDownloadProgressPercent(
  downloadPercent: number | null,
): number | null {
  if (downloadPercent == null || Number.isNaN(downloadPercent)) {
    return null
  }
  return Math.min(100, Math.max(0, Math.round(downloadPercent)))
}
