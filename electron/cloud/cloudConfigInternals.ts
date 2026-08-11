import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { DEFAULT_SCANNER_WEB_ADDRESS } from '../config/appDefaults'

export function parseEnvFile(rootDir = process.cwd()): Record<string, string> {
  const filePath = path.join(rootDir, '.env')
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const values: Record<string, string> = {}

  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    values[key] = value
  }

  return values
}

export function getEnvValueForCloudConfig(key: string): string | null {
  const fileValues = parseEnvFile()
  const value = process.env[key] ?? fileValues[key]
  const trimmed = value?.trim()
  return trimmed || null
}

export function readPublicCloudSettingsSync(): {
  mobileServiceUrl: string | null
  mobilePublicKey: string | null
  conferenceId: string | null
  mobileAppUrl: string | null
} {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings', 'app-settings.json')
    if (!fs.existsSync(settingsPath)) {
      return {
        mobileServiceUrl: null,
        mobilePublicKey: null,
        conferenceId: null,
        mobileAppUrl: null,
      }
    }

    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>
    const mobileAppUrl =
      (typeof parsed.mobileAppUrl === 'string' ? parsed.mobileAppUrl : null) ??
      (typeof parsed.mobileScannerUrl === 'string' ? parsed.mobileScannerUrl : null)

    return {
      mobileServiceUrl: typeof parsed.mobileServiceUrl === 'string' ? parsed.mobileServiceUrl : null,
      mobilePublicKey: typeof parsed.mobilePublicKey === 'string' ? parsed.mobilePublicKey : null,
      conferenceId: typeof parsed.conferenceId === 'string' ? parsed.conferenceId : null,
      mobileAppUrl,
    }
  } catch {
    return {
      mobileServiceUrl: null,
      mobilePublicKey: null,
      conferenceId: null,
      mobileAppUrl: null,
    }
  }
}

/** Local install / Advanced secret only — never packaged defaults. */
export function readDesktopConnectionKeySync(): string | null {
  const { safeStorage } = require('electron') as typeof import('electron')
  const secretsPath = path.join(app.getPath('userData'), 'settings', 'secrets.bin')
  const fallbackPath = path.join(app.getPath('userData'), 'settings', 'secrets.fallback.json')

  if (safeStorage.isEncryptionAvailable() && fs.existsSync(secretsPath)) {
    try {
      const decrypted = safeStorage.decryptString(fs.readFileSync(secretsPath))
      const parsed = JSON.parse(decrypted) as { mobileDesktopConnectionKey?: string | null }
      return parsed.mobileDesktopConnectionKey ?? null
    } catch {
      return null
    }
  }

  if (fs.existsSync(fallbackPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(fallbackPath, 'utf8')) as {
        mobileDesktopConnectionKey?: string | null
      }
      return parsed.mobileDesktopConnectionKey ?? null
    } catch {
      return null
    }
  }

  return null
}

export function getMobileAppUrlFromConfig(): string | null {
  const settings = readPublicCloudSettingsSync()
  if (settings.mobileAppUrl?.trim()) {
    return settings.mobileAppUrl.trim()
  }

  const fromEnv =
    getEnvValueForCloudConfig('MOBILE_APP_URL') ??
    getEnvValueForCloudConfig('MOBILE_SCANNER_URL') ??
    getEnvValueForCloudConfig('FOXBRIDGE_SCANNER_URL')
  return fromEnv?.trim() || null
}

/** HTTPS scanner PWA address used in pairing QR codes. */
export function getScannerWebAddressFromConfig(): string | null {
  const fromSettings = getMobileAppUrlFromConfig()
  const raw = fromSettings || DEFAULT_SCANNER_WEB_ADDRESS || null
  if (!raw) {
    return null
  }

  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:') {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}
