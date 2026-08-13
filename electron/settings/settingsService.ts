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
import { isFoxBridgeCloudPrivilegedConfigured } from '../cloud/cloudConfig'
import { getCloudStatus, publishAttendees } from '../cloud/publishAttendeesRepository'
import { readDeskCredentialSync } from '../cloud/deskCredentialStore'
import {
  claimPrincipalDesktopWithRegFox,
  enrollDesktopWithCode,
  issueLinkedDesktopJoinCode,
  listConnectedDesks,
  redeemLinkedDesktopJoin,
  revokeLinkedDesktop,
} from '../cloud/desktopCloudApi'
import { ensureScannerSession } from '../cloud/scannerSessionRepository'
import { resetSupabaseServiceClient } from '../cloud/supabaseClient'
import {
  isConferenceUuid,
  testSupabaseConnection,
} from '../cloud/supabaseConnectionTest'
import { getPreferredPrinterName } from '../printing/preferredPrinterStore'
import {
  getAttendeeCache,
  getAttendeeCacheEventId,
  isAttendeeCacheLoaded,
  replaceAttendeeCacheFromRegistrationSync,
} from '../scannerServer/attendeeCache'
import { readSecrets, writeSecrets, patchSecrets, getSafeStorageStatus } from './secretStore'
import {
  migrateSettingsFromEnvIfNeeded,
  patchPublicSettings,
  readPublicSettings,
} from './settingsStore'
import { createRegFoxServiceFromSettings } from '../regfox/regfoxConfig'
import { mergeAttendeesWithPersistedCheckIns } from '../regfox/checkInAttendee'
import { activateRegFoxEvent } from './eventIdentityService'
import { canSilentPrincipalClaimFromStoredRegFox, isDeskDeviceRole } from '../../src/shared/cloud/deskRolePolicy'
import {
  establishEventAccessSession,
  getEventAccessSession,
  isEventAccessUnlocked,
} from '../session/eventAccessSession'

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
    foxbridgeDeskToken: patch.foxbridgeDeskToken ?? current.foxbridgeDeskToken,
    foxbridgeDeskDeviceId:
      patch.foxbridgeDeskDeviceId ?? current.foxbridgeDeskDeviceId,
    foxbridgeDeskConferenceId:
      patch.foxbridgeDeskConferenceId ?? current.foxbridgeDeskConferenceId,
    foxbridgeDeskRole: patch.foxbridgeDeskRole ?? current.foxbridgeDeskRole,
    foxbridgeDeskExpiresAt:
      patch.foxbridgeDeskExpiresAt ?? current.foxbridgeDeskExpiresAt,
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
  const mobileConfigured = isFoxBridgeCloudPrivilegedConfigured()

  const unlocked = isEventAccessUnlocked()
  const session = unlocked ? getEventAccessSession() : null
  // While locked, do not expose attendee counts / conference labels that would
  // let the wizard treat the event as already connected without re-auth.
  // While unlocked, count only the session event's cache — never another event.
  const attendeeCount =
    unlocked &&
    session?.eventId &&
    isAttendeeCacheLoaded() &&
    getAttendeeCacheEventId() === session.eventId
      ? getAttendeeCache().length
      : 0

  const foxbridgeSyncEnrolled = unlocked && cloudStatus.deskCredentialConfigured
  const foxbridgeSyncConnected =
    unlocked && cloudStatus.deskCredentialConfigured && cloudStatus.connected

  return {
    setupComplete: settings.setupComplete,
    regfoxConfigured: unlocked ? regfoxConfigured : false,
    mobileConfigured,
    mobileConnected: unlocked ? cloudStatus.connected : false,
    foxbridgeSyncEnrolled,
    foxbridgeSyncConnected,
    foxbridgeSyncConnectionError: unlocked ? cloudStatus.connectionError : null,
    foxbridgeSyncDeskRole: unlocked ? cloudStatus.deskRole : null,
    foxbridgeSyncDeskExpiresAt: unlocked ? cloudStatus.deskExpiresAt : null,
    attendeeCount,
    preferredPrinterName,
    printerAvailable: preferredPrinterName
      ? printerNames.includes(preferredPrinterName)
      : false,
    conferenceName: unlocked
      ? (settings.conferenceName ?? cloudStatus.conferenceName)
      : null,
    lastAttendeeUpdate: unlocked ? settings.lastAttendeeSyncAt : null,
    lastMobilePublishAt: unlocked ? cloudStatus.lastPublishAt : null,
    lastMobilePublishWarning: unlocked ? settings.lastMobilePublishWarning : null,
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

  // Fail-closed during event switch: drop any prior event's in-memory snapshot
  // before the RegFox download so unlock/publish cannot see Event A mid-switch.
  const {
    clearAttendeeCache,
    getAttendeeCacheEventId,
  } = await import('../scannerServer/attendeeCache')
  const priorSettings = await readPublicSettings()
  const priorPlatform = priorSettings.regfoxEventId?.trim() || null
  if (
    getAttendeeCacheEventId() ||
    (priorPlatform && priorPlatform !== trimmedEventId)
  ) {
    clearAttendeeCache()
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
  const syncedAt = new Date().toISOString()
  const settings = await readPublicSettings()
  // Keep regfoxEventId for RegFox workflows; associate Local Event Store with FoxBridge Event id.
  // Do not reuse a stale Event A conferenceName as the Event B FoxBridge Event name when
  // switching — prefer a neutral name until Cloud claim returns the canonical conference name.
  const nameForEvent =
    priorPlatform && priorPlatform !== trimmedEventId
      ? `RegFox ${trimmedEventId}`
      : settings.conferenceName
  const foxEvent = await activateRegFoxEvent({
    platformEventId: trimmedEventId,
    name: nameForEvent,
    markSynced: true,
    syncedAt,
  })
  await patchPublicSettings({
    lastAttendeeSyncAt: syncedAt,
  })
  replaceAttendeeCacheFromRegistrationSync({
    attendees: mergeAttendeesWithPersistedCheckIns(attendees, foxEvent.id),
    eventId: foxEvent.id,
    sourcePlatform: 'regfox',
    syncedAt,
  })

  // Sprint 23.2: RegFox connect alone does NOT unlock. Only publish when the
  // active session already matches this FoxBridge Event (never publish under a
  // stale Event A session after switching RegFox credentials to Event B).
  const session = getEventAccessSession()
  const publishWarning =
    isEventAccessUnlocked() && session?.eventId === foxEvent.id
      ? await publishAttendeesIfConfigured()
      : null
  if (publishWarning !== null) {
    await patchPublicSettings({
      lastMobilePublishWarning: publishWarning,
    })
  }

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
    const settings = await readPublicSettings()
    const platformEventId =
      settings.regfoxEventId?.trim() || attendees[0]?.eventId || ''
    if (!platformEventId) {
      return {
        success: false,
        attendeeCount: 0,
        message: 'RegFox page ID is missing.',
      }
    }

    const syncedAt = new Date().toISOString()
    const foxEvent = await activateRegFoxEvent({
      platformEventId,
      name: settings.conferenceName,
      markSynced: true,
      syncedAt,
    })
    replaceAttendeeCacheFromRegistrationSync({
      attendees: mergeAttendeesWithPersistedCheckIns(attendees, foxEvent.id),
      eventId: foxEvent.id,
      sourcePlatform: 'regfox',
      syncedAt,
    })
    await patchPublicSettings({ lastAttendeeSyncAt: syncedAt })

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
  const desk = readDeskCredentialSync()

  // Linked Desktop: Refresh = Cloud → local for the authenticated conference.
  // Never imply RegFox download or Principal publish (Linked has no RegFox role).
  if (desk?.role === 'linked') {
    const { hydrateAttendeesFromCloudForSession } = await import(
      '../cloud/hydrateAttendeesFromCloud'
    )
    const hydrate = await hydrateAttendeesFromCloudForSession()
    if (!hydrate.success) {
      await patchPublicSettings({
        lastMobilePublishWarning:
          hydrate.message ??
          'Could not download the latest registrations for this FoxBridge Event.',
      })
      return {
        success: false,
        attendeeCount: 0,
        publishedToMobile: false,
        publishError: null,
        message:
          hydrate.message ??
          'Could not download the latest registrations for this FoxBridge Event.',
      }
    }

    await patchPublicSettings({ lastMobilePublishWarning: null })
    const { requestDesktopSyncBestEffort } = await import('../sync/syncManager')
    void requestDesktopSyncBestEffort()

    return {
      success: true,
      attendeeCount: hydrate.attendeeCount,
      publishedToMobile: false,
      publishError: null,
      message: null,
    }
  }

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

  // Refresh order (23.5b1): RegFox → overlay merge (in load) → publish →
  // check-in sync converge → upstream reconciliation kick.
  const { requestDesktopSyncBestEffort, requestCheckInSyncBestEffort } = await import(
    '../sync/syncManager'
  )
  await requestCheckInSyncBestEffort()
  void requestDesktopSyncBestEffort()

  if (readDeskCredentialSync()?.role === 'principal') {
    const { requestUpstreamCheckInReconcileBestEffort } = await import(
      '../reconcile/upstreamCheckInReconcilerManager'
    )
    requestUpstreamCheckInReconcileBestEffort()
  }

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

  if (trimmedConferenceId && !isConferenceUuid(trimmedConferenceId)) {
    return {
      success: false,
      conferenceName: null,
      message:
        'Conference ID must be a UUID from the phone scanning service, not a RegFox page ID. Leave it blank to auto-create on first publish.',
    }
  }

  const connectionTest = await testSupabaseConnection(trimmedUrl, trimmedPublic, trimmedDesktop)
  if (!connectionTest.success) {
    return {
      success: false,
      conferenceName: null,
      message: connectionTest.message,
    }
  }

  const conferencePatch: Partial<AppSettingsPublic> = {}
  if (trimmedConferenceId) {
    conferencePatch.conferenceId = trimmedConferenceId
  } else {
    const current = await readPublicSettings()
    if (current.conferenceId && !isConferenceUuid(current.conferenceId)) {
      conferencePatch.conferenceId = null
    }
  }

  await saveSettingsSecrets({ mobileDesktopConnectionKey: trimmedDesktop })
  await patchPublicSettings({
    mobileServiceUrl: trimmedUrl,
    mobilePublicKey: trimmedPublic,
    ...conferencePatch,
  })
  resetSupabaseServiceClient()

  const cloudStatus = await getCloudStatus()
  if (cloudStatus.conferenceName) {
    await patchPublicSettings({ conferenceName: cloudStatus.conferenceName })
  }

  if (cloudStatus.connected) {
    const { requestDesktopSyncBestEffort } = await import('../sync/syncManager')
    void requestDesktopSyncBestEffort()
  }

  return {
    success: true,
    conferenceName: cloudStatus.conferenceName,
    message: null,
  }
}

export async function enrollFoxBridgeCloudDesktop(
  enrollmentCode: string,
  label?: string | null,
): Promise<{
  success: boolean
  conferenceId: string | null
  conferenceName: string | null
  message: string | null
}> {
  const result = await enrollDesktopWithCode(enrollmentCode, label)
  if (!result.success || !result.conferenceId) {
    return result
  }

  const { activateCloudConferenceEvent } = await import('./eventIdentityService')
  const {
    clearAttendeeCache,
    ensureAttendeeCacheForEvent,
  } = await import('../scannerServer/attendeeCache')
  const { hydrateAttendeesFromCloudForSession } = await import(
    '../cloud/hydrateAttendeesFromCloud'
  )

  clearAttendeeCache()
  const foxEvent = await activateCloudConferenceEvent({
    conferenceId: result.conferenceId,
    name: result.conferenceName,
  })

  establishEventAccessSession({
    eventId: foxEvent.id,
    conferenceId: result.conferenceId,
    unlockMethod: 'legacy',
  })

  ensureAttendeeCacheForEvent(foxEvent.id)
  const hydrate = await hydrateAttendeesFromCloudForSession()
  if (!hydrate.success) {
    clearAttendeeCache()
    ensureAttendeeCacheForEvent(foxEvent.id)
    console.warn('[legacy-enroll] attendee hydrate failed', hydrate.message)
  }

  const { requestDesktopSyncBestEffort } = await import('../sync/syncManager')
  void requestDesktopSyncBestEffort()
  return result
}

/**
 * Sprint 22.1/22.4 — Principal claim.
 *
 * Ownership proof credentials may be supplied explicitly (required for Linked /
 * disconnected / fresh setup). Silent reuse of stored RegFox secrets is allowed
 * only for legacy desk upgrade (canSilentPrincipalClaimFromStoredRegFox).
 */
export async function claimFoxBridgeCloudPrincipal(input?: {
  label?: string | null
  confirmTransfer?: boolean
  /** Fresh RegFox API key from organizer ownership setup (never required from Linked token). */
  ownershipRegFoxApiKey?: string | null
  ownershipRegFoxEventId?: string | null
}): Promise<{
  success: boolean
  conferenceId: string | null
  conferenceName: string | null
  transferred: boolean
  needsTransferConfirmation: boolean
  message: string | null
}> {
  const [secrets, settings] = await Promise.all([readSecrets(), readPublicSettings()])
  const deskRole = isDeskDeviceRole(secrets.foxbridgeDeskRole)
    ? secrets.foxbridgeDeskRole
    : null

  const freshKey = input?.ownershipRegFoxApiKey?.trim() || ''
  const freshEventId = input?.ownershipRegFoxEventId?.trim() || ''

  let regfoxApiKey = ''
  let externalEventId = ''

  if (freshKey && freshEventId) {
    regfoxApiKey = freshKey
    externalEventId = freshEventId
  } else if (
    canSilentPrincipalClaimFromStoredRegFox(deskRole) &&
    secrets.regfoxApiKey?.trim() &&
    settings.regfoxEventId?.trim()
  ) {
    regfoxApiKey = secrets.regfoxApiKey.trim()
    externalEventId = settings.regfoxEventId.trim()
  } else {
    return {
      success: false,
      conferenceId: null,
      conferenceName: null,
      transferred: false,
      needsTransferConfirmation: false,
      message:
        'Connect RegFox with your API key and event ID to prove ownership before becoming the Principal Desktop.',
    }
  }

  // Belt-and-suspenders: Linked role cannot silent-claim even if secrets exist.
  if (deskRole === 'linked' && !(freshKey && freshEventId)) {
    return {
      success: false,
      conferenceId: null,
      conferenceName: null,
      transferred: false,
      needsTransferConfirmation: false,
      message:
        'A temporary desk cannot become Principal from its Linked connection. Enter RegFox credentials to prove ownership.',
    }
  }

  const result = await claimPrincipalDesktopWithRegFox({
    regfoxApiKey,
    externalEventId,
    label: input?.label,
    confirmTransfer: input?.confirmTransfer === true,
  })

  if (result.success && freshKey && freshEventId) {
    await patchSecrets({ regfoxApiKey: freshKey })
    await patchPublicSettings({ regfoxEventId: freshEventId })
  }

  if (result.success) {
    const settings = await readPublicSettings()
    const {
      clearAttendeeCache,
      ensureAttendeeCacheForEvent,
      getAttendeeCacheEventId,
    } = await import('../scannerServer/attendeeCache')

    const eventId =
      settings.activeEventId?.trim() || result.conferenceId || externalEventId

    // Principal may re-auth into a different RegFox event — drop any stale cache.
    if (getAttendeeCacheEventId() && getAttendeeCacheEventId() !== eventId) {
      clearAttendeeCache()
      ensureAttendeeCacheForEvent(eventId)
    }

    establishEventAccessSession({
      eventId,
      conferenceId: result.conferenceId,
      unlockMethod: 'principal',
    })

    // Publish only the session-scoped Local Event Store snapshot (identity-gated).
    const publishWarning = await publishAttendeesIfConfigured()
    if (publishWarning !== null) {
      await patchPublicSettings({ lastMobilePublishWarning: publishWarning })
    }

    const { requestDesktopSyncBestEffort } = await import('../sync/syncManager')
    void requestDesktopSyncBestEffort()
  }
  return result
}

/** Sprint 22.3 — redeem Principal-issued Linked Desktop join code. */
export async function redeemFoxBridgeLinkedJoin(input: {
  joinCode: string
  label?: string | null
}): Promise<{
  success: boolean
  conferenceId: string | null
  conferenceName: string | null
  expiresAt: string | null
  message: string | null
}> {
  const result = await redeemLinkedDesktopJoin(input)
  if (!result.success || !result.conferenceId) {
    return result
  }

  const { activateCloudConferenceEvent } = await import('./eventIdentityService')
  const {
    clearAttendeeCache,
    ensureAttendeeCacheForEvent,
  } = await import('../scannerServer/attendeeCache')
  const { hydrateAttendeesFromCloudForSession } = await import(
    '../cloud/hydrateAttendeesFromCloud'
  )

  // Switch Local Event Store / activeEventId to the joined Cloud conference.
  // Never keep Event A activeEventId while conference is Event B.
  clearAttendeeCache()
  const foxEvent = await activateCloudConferenceEvent({
    conferenceId: result.conferenceId,
    name: result.conferenceName,
  })

  // Linked is Cloud-conference-scoped — do not retain a prior Principal RegFox
  // page id (pollutes resolve metadata) or a stale phone-publish warning.
  await patchPublicSettings({
    regfoxEventId: null,
    lastMobilePublishWarning: null,
  })

  establishEventAccessSession({
    eventId: foxEvent.id,
    conferenceId: result.conferenceId,
    unlockMethod: 'linked',
  })

  // Bind cache to Event B only (empty until Cloud hydrate). Never serve Event A.
  ensureAttendeeCacheForEvent(foxEvent.id)
  const hydrate = await hydrateAttendeesFromCloudForSession()
  if (!hydrate.success) {
    // Fail-closed: keep Event B empty cache rather than leaking Event A.
    // Force reload from Local Event Store if a prior snapshot existed.
    clearAttendeeCache()
    ensureAttendeeCacheForEvent(foxEvent.id)
    await patchPublicSettings({
      lastMobilePublishWarning:
        hydrate.message ??
        'Could not download the latest registrations for this FoxBridge Event.',
    })
    console.warn('[linked-join] attendee hydrate failed', hydrate.message)
  } else {
    await patchPublicSettings({ lastMobilePublishWarning: null })
  }

  const { requestDesktopSyncBestEffort } = await import('../sync/syncManager')
  void requestDesktopSyncBestEffort()
  return result
}

export async function issueFoxBridgeJoinCode(input?: {
  label?: string | null
  ttlMinutes?: number
}) {
  return issueLinkedDesktopJoinCode(input)
}

export async function listFoxBridgeConnectedDesks() {
  return listConnectedDesks()
}

export async function revokeFoxBridgeLinkedDesktop(deskDeviceId: string) {
  return revokeLinkedDesktop(deskDeviceId)
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
    const desk = readDeskCredentialSync()
    if (desk?.role === 'linked') {
      const { hydrateAttendeesFromCloudForSession } = await import(
        '../cloud/hydrateAttendeesFromCloud'
      )
      const hydrate = await hydrateAttendeesFromCloudForSession()
      if (!hydrate.success || getAttendeeCache().length === 0) {
        return {
          success: false,
          conferenceName: cloudStatus.conferenceName,
          attendeeCount: 0,
          publishedAt: null,
          scannerCode: null,
          scannerLabel: null,
          mobileScannerUrl: resolvedUrl,
          message:
            hydrate.message ??
            'Download event registrations from FoxBridge Cloud before setting up mobile scanners.',
        }
      }
    } else {
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
  }

  const desk = readDeskCredentialSync()
  // Linked: Principal-published Cloud snapshot is already the phone source of truth.
  // Do not attempt attendee publish (Principal-only).
  if (desk?.role === 'linked') {
    const session = await ensureScannerSession()
    await patchPublicSettings({
      conferenceName: cloudStatus.conferenceName,
    })
    return {
      success: true,
      conferenceName: cloudStatus.conferenceName,
      attendeeCount: getAttendeeCache().length,
      publishedAt: cloudStatus.lastPublishAt,
      scannerCode: session.code,
      scannerLabel: session.label,
      mobileScannerUrl: resolvedUrl,
      message: null,
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
