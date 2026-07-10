import fs from 'node:fs/promises'
import type { AppSettingsPublic, AppLanguage } from '../../src/shared/models/AppSettings'
import { ensureSettingsDirectory, getSettingsFilePath } from './settingsPaths'

const DEFAULT_SETTINGS: AppSettingsPublic = {
  language: 'en',
  regfoxEventId: null,
  conferenceId: null,
  mobileServiceUrl: null,
  mobilePublicKey: null,
  mobileAppUrl: null,
  mobileScannerUrl: null,
  setupComplete: false,
  conferenceName: null,
  lastAttendeeSyncAt: null,
  showDesktopMealValidation: false,
  lastMobilePublishWarning: null,
}

export async function readPublicSettings(): Promise<AppSettingsPublic> {
  await ensureSettingsDirectory()

  try {
    const raw = await fs.readFile(getSettingsFilePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppSettingsPublic>
    const mobileAppUrl = parsed.mobileAppUrl ?? parsed.mobileScannerUrl ?? null
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      mobileAppUrl,
      mobileScannerUrl: parsed.mobileScannerUrl ?? mobileAppUrl,
      language: parsed.language === 'es' ? 'es' : 'en',
      showDesktopMealValidation: parsed.showDesktopMealValidation === true,
      lastMobilePublishWarning:
        typeof parsed.lastMobilePublishWarning === 'string'
          ? parsed.lastMobilePublishWarning
          : null,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function writePublicSettings(settings: AppSettingsPublic): Promise<void> {
  await ensureSettingsDirectory()
  await fs.writeFile(getSettingsFilePath(), `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
}

export async function patchPublicSettings(
  patch: Partial<AppSettingsPublic>,
): Promise<AppSettingsPublic> {
  const current = await readPublicSettings()
  const next: AppSettingsPublic = {
    ...current,
    ...patch,
    language: patch.language === 'es' ? 'es' : patch.language === 'en' ? 'en' : current.language,
  }
  await writePublicSettings(next)
  return next
}

export function isPlaceholderRegFoxValue(value: string | undefined): boolean {
  return !value || value === 'your_api_key_here' || value === 'your_test_event_id_here'
}

function parseEnvFile(rootDir: string): Record<string, string> {
  const fsSync = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')
  const filePath = path.join(rootDir, '.env')
  if (!fsSync.existsSync(filePath)) {
    return {}
  }

  const values: Record<string, string> = {}
  for (const line of fsSync.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }
    values[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim()
  }
  return values
}

function getEnvValue(key: string): string | undefined {
  const fileValues = parseEnvFile(process.cwd())
  const value = process.env[key] ?? fileValues[key]
  const trimmed = value?.trim()
  return trimmed || undefined
}

export async function migrateSettingsFromEnvIfNeeded(): Promise<void> {
  const current = await readPublicSettings()
  const secretsModule = await import('./secretStore')
  const secrets = await secretsModule.readSecrets()

  const envEventId = getEnvValue('REGFOX_EVENT_ID')
  const envApiKey = getEnvValue('REGFOX_API_KEY')
  const envUrl = getEnvValue('SUPABASE_URL')
  const envAnon = getEnvValue('SUPABASE_ANON_KEY')
  const envConferenceId = getEnvValue('SUPABASE_CONFERENCE_ID')
  const envServiceRole = getEnvValue('SUPABASE_SERVICE_ROLE_KEY')
  const envMobileUrl = getEnvValue('MOBILE_APP_URL') ?? getEnvValue('MOBILE_SCANNER_URL')

  const patch: Partial<AppSettingsPublic> = {}
  let secretsChanged = false
  const nextSecrets = { ...secrets }

  if (!current.regfoxEventId && envEventId && !isPlaceholderRegFoxValue(envEventId)) {
    patch.regfoxEventId = envEventId
  }

  if (!secrets.regfoxApiKey && envApiKey && !isPlaceholderRegFoxValue(envApiKey)) {
    nextSecrets.regfoxApiKey = envApiKey
    secretsChanged = true
  }

  if (!current.mobileServiceUrl && envUrl) {
    patch.mobileServiceUrl = envUrl
  }

  if (!current.mobilePublicKey && envAnon) {
    patch.mobilePublicKey = envAnon
  }

  if (!current.conferenceId && envConferenceId) {
    patch.conferenceId = envConferenceId
  }

  if (!secrets.mobileDesktopConnectionKey && envServiceRole) {
    nextSecrets.mobileDesktopConnectionKey = envServiceRole
    secretsChanged = true
  }

  if (!current.mobileAppUrl && !current.mobileScannerUrl && envMobileUrl) {
    patch.mobileAppUrl = envMobileUrl
    patch.mobileScannerUrl = envMobileUrl
  }

  const hasRegfox =
    Boolean((patch.regfoxEventId ?? current.regfoxEventId) && (nextSecrets.regfoxApiKey ?? secrets.regfoxApiKey))

  if (!current.setupComplete && hasRegfox) {
    patch.setupComplete = true
  }

  if (Object.keys(patch).length > 0) {
    await patchPublicSettings(patch)
  }

  if (secretsChanged) {
    await secretsModule.writeSecrets(nextSecrets)
  }
}

export type { AppLanguage }
