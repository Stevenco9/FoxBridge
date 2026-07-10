import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { DEFAULT_SCANNER_WEB_ADDRESS } from '../config/appDefaults'

export interface SupabaseConnectionConfig {
  url: string
  serviceRoleKey: string
  anonKey: string
}

export interface SupabaseConfig extends SupabaseConnectionConfig {
  conferenceId: string | null
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

function loadSupabaseConnectionConfigFromEnv(): SupabaseConnectionConfig | null {
  const url = getEnvValue('SUPABASE_URL')
  const serviceRoleKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = getEnvValue('SUPABASE_ANON_KEY')

  if (!url || !serviceRoleKey || !anonKey) {
    return null
  }

  return {
    url,
    serviceRoleKey,
    anonKey,
  }
}

export function loadSupabaseConnectionConfig(): SupabaseConnectionConfig | null {
  const settings = readPublicSettingsSync()
  const desktopConnectionKey = readDesktopConnectionKeySync()

  const url = settings.mobileServiceUrl ?? getEnvValue('SUPABASE_URL')
  const anonKey = settings.mobilePublicKey ?? getEnvValue('SUPABASE_ANON_KEY')
  const serviceRoleKey =
    desktopConnectionKey ?? getEnvValue('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !serviceRoleKey || !anonKey) {
    return loadSupabaseConnectionConfigFromEnv()
  }

  return {
    url,
    serviceRoleKey,
    anonKey,
  }
}

function loadSupabaseConfigFromEnv(): SupabaseConfig | null {
  const connection = loadSupabaseConnectionConfigFromEnv()
  if (!connection) {
    return null
  }

  return {
    ...connection,
    conferenceId: getEnvValue('SUPABASE_CONFERENCE_ID') ?? null,
  }
}

export function loadSupabaseConfig(): SupabaseConfig | null {
  const connection = loadSupabaseConnectionConfig()
  if (!connection) {
    return loadSupabaseConfigFromEnv()
  }

  const settings = readPublicSettingsSync()

  return {
    ...connection,
    conferenceId: settings.conferenceId ?? getEnvValue('SUPABASE_CONFERENCE_ID') ?? null,
  }
}

export function isSupabaseConfigured(): boolean {
  return loadSupabaseConnectionConfig() !== null
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
  const raw = fromSettings || DEFAULT_SCANNER_WEB_ADDRESS || null
  if (!raw) {
    return null
  }

  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:') {
      return null
    }
    // Pairing links need a clean origin; strip path/query like ?organizer=1.
    return url.origin
  } catch {
    return null
  }
}
