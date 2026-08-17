import type { UpdateState, UpdateStatus } from '../models/UpdateStatus'

/** Quiet startup check ~30–60s after app ready (packaged builds only). */
export const UPDATE_STARTUP_DELAY_MS = 45_000

/** Periodic background check while the app remains open (~5 hours). */
export const UPDATE_PERIODIC_INTERVAL_MS = 5 * 60 * 60 * 1000

export function createDisabledUpdateStatus(currentVersion: string): UpdateStatus {
  return {
    state: 'idle',
    updaterEnabled: false,
    currentVersion,
    availableVersion: null,
    downloadPercent: null,
    errorSafeMessage: null,
    lastCheckedAt: null,
  }
}

export function createIdleUpdateStatus(currentVersion: string): UpdateStatus {
  return {
    state: 'idle',
    updaterEnabled: true,
    currentVersion,
    availableVersion: null,
    downloadPercent: null,
    errorSafeMessage: null,
    lastCheckedAt: null,
  }
}

export function clampDownloadPercent(percent: number | null | undefined): number | null {
  if (percent == null || Number.isNaN(percent)) {
    return null
  }
  return Math.min(100, Math.max(0, Math.round(percent)))
}

export function shouldSkipScheduledCheck(state: UpdateState): boolean {
  return state === 'checking' || state === 'downloading'
}

export function canDownloadUpdate(state: UpdateState, updaterEnabled: boolean): boolean {
  return updaterEnabled && state === 'available'
}

export function canRestartAndInstall(state: UpdateState, updaterEnabled: boolean): boolean {
  return updaterEnabled && state === 'downloaded'
}

/**
 * Map electron-updater / network failures to volunteer-safe copy.
 * Detailed diagnostics stay in main-process logs only.
 */
export function normalizeUpdateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (
    /network|offline|enotfound|econnrefused|econnreset|etimedout|timeout|nsurlerrordomain|-1009|-1001|-1005|dns|fetch failed|socket hang up|getaddrinfo|unable to connect|connection (?:was )?lost|temporarily unavailable/i.test(
      message,
    )
  ) {
    return 'Unable to check for updates right now. Check your internet connection and try again.'
  }

  if (/404|not found|no published|could not find|releases? not found|latest-mac\.yml/i.test(lower)) {
    return 'No update is available from FoxBridge release servers right now.'
  }

  if (/signature|integrity|checksum|sha512|verification|corrupt|hash/i.test(lower)) {
    return 'The update could not be verified. Try again later or contact your organizer.'
  }

  if (/download/i.test(lower) && /fail|cancel|abort|interrupt|incomplete/i.test(lower)) {
    return 'The update download did not complete. Try again when your connection is stable.'
  }

  if (/401|403|unauthorized|authentication|invalid credentials|app-specific password/i.test(lower)) {
    return 'Unable to reach the update service right now.'
  }

  if (/install|quitandinstall|not downloaded|not ready/i.test(lower)) {
    return 'The update is not ready to install yet.'
  }

  return 'Unable to check for updates right now.'
}

/** Sanitize updater errors before writing to local main-process logs. */
export function formatUpdateErrorForLog(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown')
  return message
    .replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/gi, '[redacted]')
    .replace(/gh[pousr]_[A-Za-z0-9_]+/gi, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/password[=:\s]+[^\s,]+/gi, 'password=[redacted]')
}

export function applyCheckingStatus(status: UpdateStatus): UpdateStatus {
  return {
    ...status,
    state: 'checking',
    errorSafeMessage: null,
  }
}

export function applyAvailableStatus(
  status: UpdateStatus,
  availableVersion: string,
  checkedAt: string,
): UpdateStatus {
  return {
    ...status,
    state: 'available',
    availableVersion,
    downloadPercent: null,
    errorSafeMessage: null,
    lastCheckedAt: checkedAt,
  }
}

export function applyUpToDateStatus(status: UpdateStatus, checkedAt: string): UpdateStatus {
  return {
    ...status,
    state: 'upToDate',
    availableVersion: null,
    downloadPercent: null,
    errorSafeMessage: null,
    lastCheckedAt: checkedAt,
  }
}

export function applyDownloadingStatus(
  status: UpdateStatus,
  downloadPercent: number | null,
): UpdateStatus {
  return {
    ...status,
    state: 'downloading',
    downloadPercent,
    errorSafeMessage: null,
  }
}

export function applyDownloadedStatus(
  status: UpdateStatus,
  availableVersion: string | null,
): UpdateStatus {
  return {
    ...status,
    state: 'downloaded',
    availableVersion: availableVersion ?? status.availableVersion,
    downloadPercent: 100,
    errorSafeMessage: null,
  }
}

export function applyErrorStatus(status: UpdateStatus, errorSafeMessage: string): UpdateStatus {
  return {
    ...status,
    state: 'error',
    errorSafeMessage,
    downloadPercent: null,
  }
}
