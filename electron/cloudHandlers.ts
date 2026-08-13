import { ipcMain } from 'electron'
import type { Attendee } from '../src/shared/models'
import { getMobileScannerInfo } from './cloud/mobileScannerInfoRepository'
import { loadMealDashboard, loadMealDashboardDetail } from './cloud/mealDashboardRepository'
import { loadAttendeeMealValidations } from './cloud/attendeeMealStatusRepository'
import { getCloudStatus, publishAttendees } from './cloud/publishAttendeesRepository'
import { getFoxBridgeCloudConfigInfo } from './cloud/cloudConfig'
import { getConnectPhoneInfo } from './mobile/connectPhoneRepository'
import { createScannerPairing, getPairingStatus } from './mobile/pairingRepository'
import { assertEventAccessUnlocked, isEventAccessUnlocked } from './session/eventAccessSession'

import {
  setupMobileScanner,
  testMobileService,
  enrollFoxBridgeCloudDesktop,
  claimFoxBridgeCloudPrincipal,
  redeemFoxBridgeLinkedJoin,
  issueFoxBridgeJoinCode,
  listFoxBridgeConnectedDesks,
  revokeFoxBridgeLinkedDesktop,
} from './settings/settingsService'

export function registerCloudHandlers(): void {
  ipcMain.removeHandler('cloud:getConfigInfo')
  ipcMain.handle('cloud:getConfigInfo', async () => {
    const info = getFoxBridgeCloudConfigInfo()
    if (!isEventAccessUnlocked()) {
      return {
        ...info,
        deskCredentialConfigured: false,
        readyForPrivilegedDesktopOps: false,
        cloudOpsTransport: 'none' as const,
      }
    }
    return info
  })

  // Allowed while locked for Sync unlock UX — redacted so persisted desk does not look "connected".
  ipcMain.removeHandler('cloud:getStatus')
  ipcMain.handle('cloud:getStatus', async () => {
    if (!isEventAccessUnlocked()) {
      const config = getFoxBridgeCloudConfigInfo()
      return {
        configured: config.publicSource !== 'none',
        connected: false,
        conferenceId: null,
        conferenceName: null,
        lastPublishAt: null,
        lastPublishAttendeeCount: null,
        lastPublishError: null,
        deskCredentialConfigured: false,
        connectionError: null,
        deskRole: null,
        deskExpiresAt: null,
      }
    }
    return getCloudStatus()
  })

  ipcMain.removeHandler('cloud:getMobileScannerInfo')
  ipcMain.handle('cloud:getMobileScannerInfo', async () => {
    assertEventAccessUnlocked()
    return getMobileScannerInfo()
  })

  ipcMain.removeHandler('cloud:getMealDashboard')
  ipcMain.handle('cloud:getMealDashboard', async () => {
    assertEventAccessUnlocked()
    return loadMealDashboard()
  })

  ipcMain.removeHandler('cloud:getMealDashboardDetail')
  ipcMain.handle('cloud:getMealDashboardDetail', async (_event, mealKey: string) => {
    assertEventAccessUnlocked()
    return loadMealDashboardDetail(mealKey)
  })

  ipcMain.removeHandler('cloud:getAttendeeMealValidations')
  ipcMain.handle('cloud:getAttendeeMealValidations', async (_event, attendeeIds: string[]) => {
    assertEventAccessUnlocked()
    return loadAttendeeMealValidations(attendeeIds)
  })

  ipcMain.removeHandler('cloud:publishAttendees')
  ipcMain.handle('cloud:publishAttendees', async (_event, attendees?: Attendee[]) => {
    assertEventAccessUnlocked()
    return publishAttendees(attendees)
  })

  ipcMain.removeHandler('cloud:testMobileService')
  ipcMain.handle(
    'cloud:testMobileService',
    async (
      _event,
      payload: {
        serviceUrl: string
        publicKey: string
        desktopConnectionKey: string
        conferenceId?: string | null
      },
    ) =>
      testMobileService(
        payload.serviceUrl,
        payload.publicKey,
        payload.desktopConnectionKey,
        payload.conferenceId,
      ),
  )

  ipcMain.removeHandler('cloud:enrollDesktop')
  ipcMain.handle(
    'cloud:enrollDesktop',
    async (_event, payload: { enrollmentCode: string; label?: string | null }) =>
      enrollFoxBridgeCloudDesktop(payload.enrollmentCode, payload.label),
  )

  ipcMain.removeHandler('cloud:claimPrincipal')
  ipcMain.handle(
    'cloud:claimPrincipal',
    async (
      _event,
      payload?: {
        label?: string | null
        confirmTransfer?: boolean
        ownershipRegFoxApiKey?: string | null
        ownershipRegFoxEventId?: string | null
      },
    ) => claimFoxBridgeCloudPrincipal(payload),
  )

  ipcMain.removeHandler('cloud:redeemJoin')
  ipcMain.handle(
    'cloud:redeemJoin',
    async (_event, payload: { joinCode: string; label?: string | null }) =>
      redeemFoxBridgeLinkedJoin(payload),
  )

  ipcMain.removeHandler('cloud:issueJoinCode')
  ipcMain.handle(
    'cloud:issueJoinCode',
    async (_event, payload?: { label?: string | null; ttlMinutes?: number }) => {
      assertEventAccessUnlocked()
      return issueFoxBridgeJoinCode(payload)
    },
  )

  ipcMain.removeHandler('cloud:listDesks')
  ipcMain.handle('cloud:listDesks', async () => {
    assertEventAccessUnlocked()
    return listFoxBridgeConnectedDesks()
  })

  ipcMain.removeHandler('cloud:getUpstreamCheckInHealth')
  ipcMain.handle('cloud:getUpstreamCheckInHealth', async () => {
    assertEventAccessUnlocked()
    const { readDeskCredentialSync } = await import('./cloud/deskCredentialStore')
    const desk = readDeskCredentialSync()
    if (desk?.role !== 'principal') {
      return null
    }
    const { pullUpstreamCheckInHealthViaDesk } = await import('./cloud/desktopCloudApi')
    try {
      return await pullUpstreamCheckInHealthViaDesk()
    } catch (error) {
      console.warn(
        '[upstream-check-in-health]',
        error instanceof Error ? error.message : String(error),
      )
      return null
    }
  })

  ipcMain.removeHandler('cloud:revokeDesk')
  ipcMain.handle(
    'cloud:revokeDesk',
    async (_event, payload: { deskDeviceId: string }) => {
      assertEventAccessUnlocked()
      return revokeFoxBridgeLinkedDesktop(payload.deskDeviceId)
    },
  )

  ipcMain.removeHandler('cloud:setupMobileScanner')
  ipcMain.handle('cloud:setupMobileScanner', async () => {
    assertEventAccessUnlocked()
    return setupMobileScanner()
  })

  ipcMain.removeHandler('cloud:getConnectPhoneInfo')
  ipcMain.handle('cloud:getConnectPhoneInfo', async () => {
    assertEventAccessUnlocked()
    return getConnectPhoneInfo()
  })

  ipcMain.removeHandler('cloud:createScannerPairing')
  ipcMain.handle('cloud:createScannerPairing', async () => {
    assertEventAccessUnlocked()
    return createScannerPairing()
  })

  ipcMain.removeHandler('cloud:getPairingStatus')
  ipcMain.handle('cloud:getPairingStatus', async (_event, tokenId: string) => {
    assertEventAccessUnlocked()
    return getPairingStatus(tokenId)
  })
}
