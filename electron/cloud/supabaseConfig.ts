import fs from 'node:fs'
import path from 'node:path'

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

export function loadSupabaseConfig(): SupabaseConfig | null {
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

export function isSupabaseConfigured(): boolean {
  return loadSupabaseConfig() !== null
}
