import { RegFoxService } from '../../src/integrations/regfox/RegFoxService'
import type {
  AppSettingsPublic,
  AppSettingsSecrets,
  MobileScannerSetupResult,
  MobileServiceTestResult,
  RegFoxConnectResult,
  RegFoxUpdateResult,
  SetupStatus,
} from '../../src/shared/models/AppSettings'
import { resolvePhoneAccessibleUrl } from '../mobile/phoneUrlResolver'
import { getMobileAppUrl } from '../cloud/supabaseConfig'
import { getCloudStatus, publishAttendees } from '../cloud/publishAttendeesRepository'
import { ensureScannerSession } from '../cloud/scannerSessionRepository'
import { resetSupabaseServiceClient } from '../cloud/supabaseClient'
import { getPreferredPrinterName } from '../printing/preferredPrinterStore'
import { getAttendeeCache, isAttendeeCacheLoaded, setAttendeeCache } from '../scannerServer/attendeeCache'
import { readSecrets, writeSecrets, getSafeStorageStatus } from './secretStore'
import {
  migrateSettingsFromEnvIfNeeded,
  patchPublicSettings,
  readPublicSettings,
} from './settingsStore'
import { createRegFoxServiceFromSettings } from '../regfox/regfoxConfig'

const MOBILE_PUBLISH_WARNING =
  'Phone scanners could not be updated. Desktop registration is still available.'

async function publishAttendeesIfConfigured(): Promise<string | null> {
  const cloudStatus = await getCloudStatus()
  if (!cloudStatus.configured) {
    return null
  }

  const publishResult = await publishAttendees()
  if (!publishResult.success) {
    return MOBILE_PUBLISH_WARNING
  }

  return null
}

export async function initializeSettings(): Promise<void> {
  await migrateSettingsFromEnvIfNeeded()
}

export async function getPublicSettings(): Promise<AppSettingsPublic> {
  return readPublicSettings()
}

export async function savePublicSettings(
  patch: Partial<AppSettingsPublic>,
): Promise<AppSettingsPublic> {
  const next = await patchPublicSettings(patch)
  resetSupabaseServiceClient()
  return next
}

export async function saveSettingsSecrets(
  patch: Partial<AppSettingsSecrets>,
): Promise<void> {
  const current = await readSecrets()
  await writeSecrets({
    regfoxApiKey: patch.regfoxApiKey ?? current.regfoxApiKey,
    mobileDesktopConnectionKey:
      patch.mobileDesktopConnectionKey ?? current.mobileDesktopConnectionKey,
  })
  resetSupabaseServiceClient()
}

export async function completeSetup(): Promise<AppSettingsPublic> {
  return patchPublicSettings({ setupComplete: true })
}

export async function resetSetup(): Promise<AppSettingsPublic> {
  return patchPublicSettings({ setupComplete: false })
}

export async function getSetupStatus(printerNames: string[]): Promise<SetupStatus> {
  const settings = await readPublicSettings()
  const secrets = await readSecrets()
  const cloudStatus = await getCloudStatus()
  const preferredPrinterName = await getPreferredPrinterName()

  const regfoxConfigured = Boolean(settings.regfoxEventId && secrets.regfoxApiKey)
  const mobileConfigured = Boolean(
    settings.mobileServiceUrl &&
      settings.mobilePublicKey &&
      secrets.mobileDesktopConnectionKey,
  )

  const attendeeCount = isAttendeeCacheLoaded() ? getAttendeeCache().length : 0

  return {
    setupComplete: settings.setupComplete,
    regfoxConfigured,
    mobileConfigured,
    mobileConnected: cloudStatus.connected,
    attendeeCount,
    preferredPrinterName,
    printerAvailable: preferredPrinterName
      ? printerNames.includes(preferredPrinterName)
      : false,
    conferenceName: settings.conferenceName ?? cloudStatus.conferenceName,
    lastAttendeeUpdate: settings.lastAttendeeSyncAt,
    lastMobilePublishAt: cloudStatus.lastPublishAt,
    lastMobilePublishWarning: settings.lastMobilePublishWarning,
    language: settings.language,
    safeStorage: getSafeStorageStatus(),
  }
}

export async function connectRegFox(
  apiKey: string,
  eventId: string,
): Promise<RegFoxConnectResult> {
  const trimmedKey = apiKey.trim()
  const trimmedEventId = eventId.trim()

  if (!trimmedKey || !trimmedEventId) {
    return {
      success: false,
      attendeeCount: 0,
      message: 'Enter both the RegFox API key and page ID.',
    }
  }

  const service = new RegFoxService({ apiKey: trimmedKey, eventId: trimmedEventId })
  const connection = await service.testConnection()

  if (!connection.success) {
    return {
      success: false,
      attendeeCount: 0,
      message:
        connection.message ??
        'Could not connect to RegFox. Check your API key and page ID, then try again.',
    }
  }

  let attendees
  try {
    attendees = await service.getAttendees()
  } catch (error) {
    return {
      success: false,
      attendeeCount: 0,
      message:
        error instanceof Error
          ? error.message
          : 'Connected to RegFox but could not download attendees.',
    }
  }

  await saveSettingsSecrets({ regfoxApiKey: trimmedKey })
  await patchPublicSettings({
    regfoxEventId: trimmedEventId,
    lastAttendeeSyncAt: new Date().toISOString(),
  })
  setAttendeeCache(attendees)

  const publishWarning = await publishAttendeesIfConfigured()
  await patchPublicSettings({
    lastMobilePublishWarning: publishWarning,
  })

  return {
    success: true,
    attendeeCount: attendees.length,
    message: null,
    publishWarning,
  }
}

export async function loadRegFoxAttendees(): Promise<RegFoxConnectResult> {
  const service = await createRegFoxServiceFromSettings()
  if (!service) {
    return {
      success: false,
      attendeeCount: 0,
      message: 'RegFox is not configured yet.',
    }
  }

  try {
    const attendees = await service.getAttendees()
    setAttendeeCache(attendees)
    await patchPublicSettings({ lastAttendeeSyncAt: new Date().toISOString() })

    const publishWarning = await publishAttendeesIfConfigured()
    await patchPublicSettings({
      lastMobilePublishWarning: publishWarning,
    })

    return {
      success: true,
      attendeeCount: attendees.length,
      message: null,
      publishWarning,
    }
  } catch (error) {
    return {
      success: false,
      attendeeCount: 0,
      message:
        error instanceof Error ? error.message : 'Unable to download attendees from RegFox.',
    }
  }
}

export async function updateRegistrations(): Promise<RegFoxUpdateResult> {
  const loadResult = await loadRegFoxAttendees()
  if (!loadResult.success) {
    return {
      success: false,
      attendeeCount: 0,
      publishedToMobile: false,
      publishError: null,
      message: loadResult.message,
    }
  }

  const cloudStatus = await getCloudStatus()
  if (!cloudStatus.configured) {
    return {
      success: true,
      attendeeCount: loadResult.attendeeCount,
      publishedToMobile: false,
      publishError: null,
      message: null,
    }
  }

  const publishResult = await publishAttendees()
  const publishError = publishResult.success ? null : MOBILE_PUBLISH_WARNING
  await patchPublicSettings({
    lastMobilePublishWarning: publishError,
  })

  return {
    success: true,
    attendeeCount: loadResult.attendeeCount,
    publishedToMobile: publishResult.success,
    publishError,
    message: publishError,
  }
}

export async function testMobileService(
  serviceUrl: string,
  publicKey: string,
  desktopConnectionKey: string,
  conferenceId?: string | null,
): Promise<MobileServiceTestResult> {
  const trimmedUrl = serviceUrl.trim()
  const trimmedPublic = publicKey.trim()
  const trimmedDesktop = desktopConnectionKey.trim()
  const trimmedConferenceId = conferenceId?.trim() ?? ''

  if (!trimmedUrl || !trimmedPublic || !trimmedDesktop) {
    return {
      success: false,
      conferenceName: null,
      message: 'Fill in the service URL, public key, and desktop connection key.',
    }
  }

  await saveSettingsSecrets({ mobileDesktopConnectionKey: trimmedDesktop })
  await patchPublicSettings({
    mobileServiceUrl: trimmedUrl,
    mobilePublicKey: trimmedPublic,
    ...(trimmedConferenceId ? { conferenceId: trimmedConferenceId } : {}),
  })
  resetSupabaseServiceClient()

  const cloudStatus = await getCloudStatus()
  if (!cloudStatus.connected) {
    return {
      success: false,
      conferenceName: null,
      message: 'Could not connect to the phone scanning service. Check the URL and keys.',
    }
  }

  if (cloudStatus.conferenceName) {
    await patchPublicSettings({ conferenceName: cloudStatus.conferenceName })
  }

  return {
    success: true,
    conferenceName: cloudStatus.conferenceName,
    message: null,
  }
}

export async function setupMobileScanner(): Promise<MobileScannerSetupResult> {
  const cloudStatus = await getCloudStatus()
  const phoneResolution = await resolvePhoneAccessibleUrl(getMobileAppUrl())
  const resolvedUrl = phoneResolution.phoneUrl ?? ''

  if (!cloudStatus.configured) {
    return {
      success: false,
      conferenceName: null,
      attendeeCount: 0,
      publishedAt: null,
      scannerCode: null,
      scannerLabel: null,
      mobileScannerUrl: resolvedUrl,
      message: 'Mobile service is not configured yet.',
    }
  }

  if (!cloudStatus.connected) {
    return {
      success: false,
      conferenceName: cloudStatus.conferenceName,
      attendeeCount: 0,
      publishedAt: null,
      scannerCode: null,
      scannerLabel: null,
      mobileScannerUrl: resolvedUrl,
      message: 'Could not reach the mobile service. Check your connection settings.',
    }
  }

  if (!isAttendeeCacheLoaded() || getAttendeeCache().length === 0) {
    const loadResult = await loadRegFoxAttendees()
    if (!loadResult.success) {
      return {
        success: false,
        conferenceName: cloudStatus.conferenceName,
        attendeeCount: 0,
        publishedAt: null,
        scannerCode: null,
        scannerLabel: null,
        mobileScannerUrl: resolvedUrl,
        message: loadResult.message ?? 'Load attendees from RegFox before setting up mobile scanners.',
      }
    }
  }

  const publishResult = await publishAttendees()
  if (!publishResult.success) {
    return {
      success: false,
      conferenceName: cloudStatus.conferenceName,
      attendeeCount: publishResult.attendeeCount,
      publishedAt: null,
      scannerCode: null,
      scannerLabel: null,
      mobileScannerUrl: resolvedUrl,
      message: publishResult.error ?? 'Could not send attendees to mobile scanners.',
    }
  }

  const session = await ensureScannerSession()

  await patchPublicSettings({
    conferenceName: cloudStatus.conferenceName,
  })

  return {
    success: true,
    conferenceName: cloudStatus.conferenceName,
    attendeeCount: publishResult.attendeeCount,
    publishedAt: publishResult.publishedAt,
    scannerCode: session.code,
    scannerLabel: session.label,
    mobileScannerUrl: resolvedUrl,
    message: null,
  }
}
