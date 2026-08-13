import { safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getSettingsDirectory } from './settingsPaths'

const SECRETS_FILENAME = 'secrets.bin'
const FALLBACK_SECRETS_FILENAME = 'secrets.fallback.json'

export interface StoredSecrets {
  regfoxApiKey: string | null
  /**
   * Legacy privileged Cloud key (service role). Dev/migration only —
   * never packaged into distributed builds.
   */
  mobileDesktopConnectionKey: string | null
  /** Event-scoped FoxBridge Cloud desk credential (Sprint 21.6). */
  foxbridgeDeskToken: string | null
  foxbridgeDeskDeviceId: string | null
  foxbridgeDeskConferenceId: string | null
  /** principal | linked | legacy — set on claim/enroll/redeem (Sprint 22.2/22.3). */
  foxbridgeDeskRole: string | null
  /** ISO expiry for Linked desks; null for Principal/legacy. */
  foxbridgeDeskExpiresAt: string | null
}

const EMPTY_SECRETS: StoredSecrets = {
  regfoxApiKey: null,
  mobileDesktopConnectionKey: null,
  foxbridgeDeskToken: null,
  foxbridgeDeskDeviceId: null,
  foxbridgeDeskConferenceId: null,
  foxbridgeDeskRole: null,
  foxbridgeDeskExpiresAt: null,
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

function normalizeSecrets(parsed: Partial<StoredSecrets> | null | undefined): StoredSecrets {
  return {
    regfoxApiKey: parsed?.regfoxApiKey ?? null,
    mobileDesktopConnectionKey: parsed?.mobileDesktopConnectionKey ?? null,
    foxbridgeDeskToken: parsed?.foxbridgeDeskToken ?? null,
    foxbridgeDeskDeviceId: parsed?.foxbridgeDeskDeviceId ?? null,
    foxbridgeDeskConferenceId: parsed?.foxbridgeDeskConferenceId ?? null,
    foxbridgeDeskRole: parsed?.foxbridgeDeskRole ?? null,
    foxbridgeDeskExpiresAt: parsed?.foxbridgeDeskExpiresAt ?? null,
  }
}

async function readFallbackSecrets(): Promise<StoredSecrets> {
  try {
    const raw = await fs.readFile(getFallbackSecretsPath(), 'utf8')
    return normalizeSecrets(JSON.parse(raw) as Partial<StoredSecrets>)
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
      return normalizeSecrets(JSON.parse(decrypted) as Partial<StoredSecrets>)
    } catch {
      return { ...EMPTY_SECRETS }
    }
  }

  return readFallbackSecrets()
}

/**
 * Serialize all secret file writes so concurrent callers (claim token rotation,
 * resolve role patch, connectRegFox key save) cannot lose updates.
 */
let secretsWriteChain: Promise<unknown> = Promise.resolve()

async function writeSecretsUnlocked(secrets: StoredSecrets): Promise<void> {
  const payload = JSON.stringify(normalizeSecrets(secrets))

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

  await writeFallbackSecrets(normalizeSecrets(secrets))
}

export async function writeSecrets(secrets: StoredSecrets): Promise<void> {
  const run = secretsWriteChain.then(() => writeSecretsUnlocked(secrets))
  secretsWriteChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function patchSecrets(
  patch: Partial<StoredSecrets>,
): Promise<StoredSecrets> {
  const run = secretsWriteChain.then(async () => {
    const current = await readSecrets()
    const next = normalizeSecrets({ ...current, ...patch })
    await writeSecretsUnlocked(next)
    return next
  })
  secretsWriteChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
