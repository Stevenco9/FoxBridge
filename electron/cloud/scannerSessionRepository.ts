import { ensureConferenceId } from './conferenceRepository'
import { resolveDesktopCloudOpsTransport } from './cloudOpsTransport'
import { ensureScannerSessionViaDesk } from './desktopCloudApi'
import { getSupabaseServiceClient } from './supabaseClient'

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

  const transport = resolveDesktopCloudOpsTransport()
  if (transport === 'desk_credential') {
    return ensureScannerSessionViaDesk()
  }

  if (transport !== 'legacy_service_role') {
    throw new Error('FoxBridge Cloud is not ready for scanner setup.')
  }

  const client = getSupabaseServiceClient()
  if (!client) {
    throw new Error('Unable to connect to FoxBridge Cloud.')
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
