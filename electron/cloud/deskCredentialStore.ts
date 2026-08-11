import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface StoredDeskCredential {
  deskToken: string
  deskDeviceId: string
  conferenceId: string
}

interface SecretsFileShape {
  regfoxApiKey?: string | null
  mobileDesktopConnectionKey?: string | null
  foxbridgeDeskToken?: string | null
  foxbridgeDeskDeviceId?: string | null
  foxbridgeDeskConferenceId?: string | null
}

function settingsDir(): string {
  return path.join(app.getPath('userData'), 'settings')
}

/**
 * Synchronous desk credential read for Cloud transport resolution.
 * Prefer async secretStore APIs for writes.
 */
export function readDeskCredentialSync(): StoredDeskCredential | null {
  const { safeStorage } = require('electron') as typeof import('electron')
  const secretsPath = path.join(settingsDir(), 'secrets.bin')
  const fallbackPath = path.join(settingsDir(), 'secrets.fallback.json')

  let parsed: SecretsFileShape | null = null

  if (safeStorage.isEncryptionAvailable() && fs.existsSync(secretsPath)) {
    try {
      parsed = JSON.parse(safeStorage.decryptString(fs.readFileSync(secretsPath))) as SecretsFileShape
    } catch {
      parsed = null
    }
  } else if (fs.existsSync(fallbackPath)) {
    try {
      parsed = JSON.parse(fs.readFileSync(fallbackPath, 'utf8')) as SecretsFileShape
    } catch {
      parsed = null
    }
  }

  const deskToken = parsed?.foxbridgeDeskToken?.trim()
  const deskDeviceId = parsed?.foxbridgeDeskDeviceId?.trim()
  const conferenceId = parsed?.foxbridgeDeskConferenceId?.trim()
  if (!deskToken || !deskDeviceId || !conferenceId) {
    return null
  }

  return { deskToken, deskDeviceId, conferenceId }
}
