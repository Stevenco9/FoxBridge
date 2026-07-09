import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_PORT = 3847
const LOCALHOST = '127.0.0.1'

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
  return process.env[key] ?? fileValues[key]
}

export function isScannerServerAutoStartEnabled(): boolean {
  const value = getEnvValue('SCANNER_SERVER_ENABLED')?.trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes'
}

export function getScannerServerPort(): number {
  const raw = getEnvValue('SCANNER_SERVER_PORT')?.trim()
  if (!raw) {
    return DEFAULT_PORT
  }

  const port = Number.parseInt(raw, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`SCANNER_SERVER_PORT must be an integer between 1 and 65535. Received: ${raw}`)
  }

  return port
}

/**
 * Scanner server binds to localhost only. Mobile devices on the LAN cannot
 * reach this address; a pairing/security step is required before binding
 * to 0.0.0.0 or the host LAN address.
 */
export function getScannerServerHost(): string {
  return LOCALHOST
}
