import { safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getSettingsDirectory } from './settingsPaths'

const SECRETS_FILENAME = 'secrets.bin'
const FALLBACK_SECRETS_FILENAME = 'secrets.fallback.json'

export interface StoredSecrets {
  regfoxApiKey: string | null
  mobileDesktopConnectionKey: string | null
}

const EMPTY_SECRETS: StoredSecrets = {
  regfoxApiKey: null,
  mobileDesktopConnectionKey: null,
}

export function getSafeStorageStatus(): { available: boolean; usingFallback: boolean } {
  const available = safeStorage.isEncryptionAvailable()
  return {
    available,
    usingFallback: !available,
  }
}

function getSecretsPath(): string {
  return path.join(getSettingsDirectory(), SECRETS_FILENAME)
}

function getFallbackSecretsPath(): string {
  return path.join(getSettingsDirectory(), FALLBACK_SECRETS_FILENAME)
}

async function readFallbackSecrets(): Promise<StoredSecrets> {
  try {
    const raw = await fs.readFile(getFallbackSecretsPath(), 'utf8')
    const parsed = JSON.parse(raw) as StoredSecrets
    return {
      regfoxApiKey: parsed.regfoxApiKey ?? null,
      mobileDesktopConnectionKey: parsed.mobileDesktopConnectionKey ?? null,
    }
  } catch {
    return { ...EMPTY_SECRETS }
  }
}

async function writeFallbackSecrets(secrets: StoredSecrets): Promise<void> {
  await fs.writeFile(
    getFallbackSecretsPath(),
    `${JSON.stringify(secrets, null, 2)}\n`,
    'utf8',
  )
}

export async function readSecrets(): Promise<StoredSecrets> {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      const encrypted = await fs.readFile(getSecretsPath())
      const decrypted = safeStorage.decryptString(encrypted)
      const parsed = JSON.parse(decrypted) as StoredSecrets
      return {
        regfoxApiKey: parsed.regfoxApiKey ?? null,
        mobileDesktopConnectionKey: parsed.mobileDesktopConnectionKey ?? null,
      }
    } catch {
      return { ...EMPTY_SECRETS }
    }
  }

  return readFallbackSecrets()
}

export async function writeSecrets(secrets: StoredSecrets): Promise<void> {
  const payload = JSON.stringify(secrets)

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(payload)
    await fs.writeFile(getSecretsPath(), encrypted)
    try {
      await fs.unlink(getFallbackSecretsPath())
    } catch {
      // No fallback file to remove.
    }
    return
  }

  await writeFallbackSecrets(secrets)
}
