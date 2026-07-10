import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { DEFAULT_SCANNER_WEB_ADDRESS } from '../config/appDefaults'

export interface SupabaseConfig {
  url: string
  serviceRoleKey: string
  anonKey: string
  conferenceId: string
}

function parseEnvFile(rootDir = process.cwd()): Record<string, string> {
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

function getEnvValue(key: string): string | undefined {
  const fileValues = parseEnvFile()
  const value = process.env[key] ?? fileValues[key]
  const trimmed = value?.trim()
  return trimmed || undefined
}

function readPublicSettingsSync(): {
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

function readDesktopConnectionKeySync(): string | null {
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

function loadSupabaseConfigFromEnv(): SupabaseConfig | null {
  const url = getEnvValue('SUPABASE_URL')
  const serviceRoleKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = getEnvValue('SUPABASE_ANON_KEY')
  const conferenceId = getEnvValue('SUPABASE_CONFERENCE_ID')

  if (!url || !serviceRoleKey || !anonKey || !conferenceId) {
    return null
  }

  return {
    url,
    serviceRoleKey,
    anonKey,
    conferenceId,
  }
}

export function loadSupabaseConfig(): SupabaseConfig | null {
  const settings = readPublicSettingsSync()
  const desktopConnectionKey = readDesktopConnectionKeySync()

  const url = settings.mobileServiceUrl ?? getEnvValue('SUPABASE_URL')
  const anonKey = settings.mobilePublicKey ?? getEnvValue('SUPABASE_ANON_KEY')
  const conferenceId = settings.conferenceId ?? getEnvValue('SUPABASE_CONFERENCE_ID')
  const serviceRoleKey =
    desktopConnectionKey ?? getEnvValue('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !serviceRoleKey || !anonKey || !conferenceId) {
    return loadSupabaseConfigFromEnv()
  }

  return {
    url,
    serviceRoleKey,
    anonKey,
    conferenceId,
  }
}

export function isSupabaseConfigured(): boolean {
  return loadSupabaseConfig() !== null
}

export function getMobileAppUrl(): string | null {
  const settings = readPublicSettingsSync()
  if (settings.mobileAppUrl?.trim()) {
    return settings.mobileAppUrl.trim()
  }

  const fromEnv = getEnvValue('MOBILE_APP_URL') ?? getEnvValue('MOBILE_SCANNER_URL')
  return fromEnv?.trim() || null
}

/** @deprecated Use getMobileAppUrl */
export function getMobileScannerUrl(): string | null {
  return getMobileAppUrl()
}

/** HTTPS scanner PWA address used in pairing QR codes. */
export function getScannerWebAddress(): string | null {
  const fromSettings = getMobileAppUrl()
  if (fromSettings) {
    return fromSettings
  }

  return DEFAULT_SCANNER_WEB_ADDRESS || null
}
