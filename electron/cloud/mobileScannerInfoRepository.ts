import type { MobileScannerInfo, ScannerSessionCode } from '../../src/shared/models/MobileScannerInfo'
import { resolveDesktopCloudOpsTransport } from './cloudOpsTransport'
import { ensureScannerSessionViaDesk } from './desktopCloudApi'
import { getCloudStatus } from './publishAttendeesRepository'
import { getMobileScannerUrl } from './supabaseConfig'
import { getSupabaseServiceClient } from './supabaseClient'

export async function getMobileScannerInfo(): Promise<MobileScannerInfo> {
  const mobileScannerUrl = getMobileScannerUrl()
  const cloudStatus = await getCloudStatus()
  const transport = resolveDesktopCloudOpsTransport()

  if (!cloudStatus.configured || transport === 'none') {
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

  if (transport === 'desk_credential') {
    try {
      const session = await ensureScannerSessionViaDesk()
      const scannerSessions: ScannerSessionCode[] = [
        { code: session.code, label: session.label },
      ]
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
      return {
        configured: true,
        connected: cloudStatus.connected,
        conferenceId: cloudStatus.conferenceId,
        conferenceName: cloudStatus.conferenceName,
        mobileScannerUrl,
        scannerSessions: [],
        error: caught instanceof Error ? caught.message : 'Unable to load scanner codes.',
      }
    }
  }

  const client = getSupabaseServiceClient()
  if (!client || !cloudStatus.conferenceId) {
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
      .eq('conference_id', cloudStatus.conferenceId)
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
