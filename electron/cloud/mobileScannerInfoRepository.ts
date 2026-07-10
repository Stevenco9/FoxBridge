import type { MobileScannerInfo, ScannerSessionCode } from '../../src/shared/models/MobileScannerInfo'
import { getCloudStatus } from './publishAttendeesRepository'
import { getMobileScannerUrl, loadSupabaseConfig } from './supabaseConfig'
import { getSupabaseServiceClient } from './supabaseClient'

export async function getMobileScannerInfo(): Promise<MobileScannerInfo> {
  const mobileScannerUrl = getMobileScannerUrl()
  const cloudStatus = await getCloudStatus()

  if (!cloudStatus.configured) {
    return {
      configured: false,
      connected: false,
      conferenceId: null,
      conferenceName: null,
      mobileScannerUrl,
      scannerSessions: [],
      error: null,
    }
  }

  const config = loadSupabaseConfig()
  const client = getSupabaseServiceClient()
  if (!config || !client) {
    return {
      configured: true,
      connected: false,
      conferenceId: cloudStatus.conferenceId,
      conferenceName: cloudStatus.conferenceName,
      mobileScannerUrl,
      scannerSessions: [],
      error: null,
    }
  }

  try {
    const { data, error } = await client
      .from('scanner_sessions')
      .select('code, label')
      .eq('conference_id', config.conferenceId)
      .is('revoked_at', null)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('label')

    if (error) {
      return {
        configured: true,
        connected: cloudStatus.connected,
        conferenceId: cloudStatus.conferenceId,
        conferenceName: cloudStatus.conferenceName,
        mobileScannerUrl,
        scannerSessions: [],
        error: error.message,
      }
    }

    const scannerSessions: ScannerSessionCode[] = (data ?? []).map((row) => ({
      code: row.code as string,
      label: row.label as string,
    }))

    return {
      configured: true,
      connected: cloudStatus.connected,
      conferenceId: cloudStatus.conferenceId,
      conferenceName: cloudStatus.conferenceName,
      mobileScannerUrl,
      scannerSessions,
      error: null,
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unable to load scanner codes.'
    return {
      configured: true,
      connected: cloudStatus.connected,
      conferenceId: cloudStatus.conferenceId,
      conferenceName: cloudStatus.conferenceName,
      mobileScannerUrl,
      scannerSessions: [],
      error: message,
    }
  }
}
