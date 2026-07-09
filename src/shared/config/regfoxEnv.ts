import fs from 'node:fs'
import path from 'node:path'

interface RegFoxEnv {
  apiKey: string
  eventId: string
}

function parseEnvFile(filePath: string): Record<string, string> {
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

/**
 * Loads RegFox credentials from the local .env file and process environment.
 * Process environment variables take precedence over .env values.
 */
export function loadRegFoxEnv(rootDir = process.cwd()): RegFoxEnv {
  const fileValues = parseEnvFile(path.join(rootDir, '.env'))

  const apiKey = process.env.REGFOX_API_KEY ?? fileValues.REGFOX_API_KEY
  const eventId = process.env.REGFOX_EVENT_ID ?? fileValues.REGFOX_EVENT_ID

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error(
      'REGFOX_API_KEY is missing or still set to the placeholder value in .env',
    )
  }

  if (!eventId || eventId === 'your_test_event_id_here') {
    throw new Error(
      'REGFOX_EVENT_ID is missing or still set to the placeholder value in .env',
    )
  }

  return { apiKey, eventId }
}
