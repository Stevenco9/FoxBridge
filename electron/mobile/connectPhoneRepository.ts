import type { ConnectPhoneInfo } from '../../src/shared/models/ConnectPhoneInfo'
import { ensureScannerSession } from '../cloud/scannerSessionRepository'
import { getCloudStatus } from '../cloud/publishAttendeesRepository'
import { getMobileAppUrl } from '../cloud/supabaseConfig'
import { getMobileScannerInfo } from '../cloud/mobileScannerInfoRepository'
import { resolvePhoneAccessibleUrl } from './phoneUrlResolver'

export async function getConnectPhoneInfo(): Promise<ConnectPhoneInfo> {
  const cloudStatus = await getCloudStatus()
  const phoneResolution = await resolvePhoneAccessibleUrl(getMobileAppUrl())

  if (!cloudStatus.configured) {
    return {
      mobileConfigured: false,
      mobileConnected: false,
      phoneUrl: phoneResolution.phoneUrl,
      phoneUrlSource: phoneResolution.phoneUrlSource,
      isLocalTesting: phoneResolution.isLocalTesting,
      mobileDevServerRunning: phoneResolution.mobileDevServerRunning,
      scannerCode: null,
      scannerLabel: null,
      error: null,
    }
  }

  if (!cloudStatus.connected) {
    return {
      mobileConfigured: true,
      mobileConnected: false,
      phoneUrl: phoneResolution.phoneUrl,
      phoneUrlSource: phoneResolution.phoneUrlSource,
      isLocalTesting: phoneResolution.isLocalTesting,
      mobileDevServerRunning: phoneResolution.mobileDevServerRunning,
      scannerCode: null,
      scannerLabel: null,
      error: 'Could not reach the mobile service. Check your connection settings.',
    }
  }

  try {
    const info = await getMobileScannerInfo()
    let scannerCode: string | null = info.scannerSessions[0]?.code ?? null
    let scannerLabel: string | null = info.scannerSessions[0]?.label ?? null

    if (!scannerCode) {
      const session = await ensureScannerSession()
      scannerCode = session.code
      scannerLabel = session.label
    }

    return {
      mobileConfigured: true,
      mobileConnected: true,
      phoneUrl: phoneResolution.phoneUrl,
      phoneUrlSource: phoneResolution.phoneUrlSource,
      isLocalTesting: phoneResolution.isLocalTesting,
      mobileDevServerRunning: phoneResolution.mobileDevServerRunning,
      scannerCode,
      scannerLabel,
      error: info.error,
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unable to load scanner access code.'
    return {
      mobileConfigured: true,
      mobileConnected: cloudStatus.connected,
      phoneUrl: phoneResolution.phoneUrl,
      phoneUrlSource: phoneResolution.phoneUrlSource,
      isLocalTesting: phoneResolution.isLocalTesting,
      mobileDevServerRunning: phoneResolution.mobileDevServerRunning,
      scannerCode: null,
      scannerLabel: null,
      error: message,
    }
  }
}
