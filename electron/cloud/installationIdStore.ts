import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { isFoxBridgeInstallationId } from '../../src/shared/cloud/deskCredentialPolicy'

/**
 * Sprint 22.5 — stable opaque installation ID for Linked Desktop identity.
 * Identity only (not a credential). Random UUID; not hardware-derived.
 * Persistence must never throw into the join path — join can proceed with a
 * newly generated ID even if disk write fails (rejoin identity may be weaker).
 */

interface InstallationFile {
  installationId: string
  createdAt: string
}

function installationPath(): string {
  return path.join(app.getPath('userData'), 'settings', 'installation.json')
}

function tryReadInstallationId(): string | null {
  const filePath = installationPath()
  try {
    if (!fs.existsSync(filePath)) {
      return null
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as InstallationFile
    const existing = parsed?.installationId?.trim()
    if (existing && isFoxBridgeInstallationId(existing)) {
      return existing.toLowerCase()
    }
  } catch {
    return null
  }
  return null
}

function tryPersistInstallationId(installationId: string): void {
  try {
    const filePath = installationPath()
    const dir = path.dirname(filePath)
    fs.mkdirSync(dir, { recursive: true })
    const payload: InstallationFile = {
      installationId,
      createdAt: new Date().toISOString(),
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
  } catch {
    // Non-fatal: identity still returned for this process.
  }
}

export function readOrCreateInstallationIdSync(): string {
  const existing = tryReadInstallationId()
  if (existing) {
    return existing
  }

  const installationId = randomUUID().toLowerCase()
  tryPersistInstallationId(installationId)
  return installationId
}
