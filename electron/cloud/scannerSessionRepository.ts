import { ensureConferenceId } from './conferenceRepository'
import { loadSupabaseConnectionConfig } from './supabaseConfig'

function generateScannerCode(): string {
  const suffix = Math.random().toString(36).slice(2, 6)
  return `meal-${suffix}`
}

export async function ensureScannerSession(): Promise<{ code: string; label: string }> {
  const { getMobileScannerInfo } = await import('./mobileScannerInfoRepository')
  const info = await getMobileScannerInfo()

  if (info.scannerSessions.length > 0) {
    return info.scannerSessions[0]
  }

  const connection = loadSupabaseConnectionConfig()
  if (!connection) {
    throw new Error('Mobile service is not configured.')
  }

  const { getSupabaseServiceClient } = await import('./supabaseClient')
  const client = getSupabaseServiceClient()
  if (!client) {
    throw new Error('Unable to connect to the mobile service.')
  }

  const conferenceId = await ensureConferenceId()
  const code = generateScannerCode()
  const label = 'Meal scanner 1'

  const { error } = await client.from('scanner_sessions').insert({
    conference_id: conferenceId,
    code,
    label,
  })

  if (error) {
    throw new Error(`Unable to create scanner access code: ${error.message}`)
  }

  return { code, label }
}
