import { ipcMain } from 'electron'
import type { Attendee } from '../src/shared/models'
import { getMobileScannerInfo } from './cloud/mobileScannerInfoRepository'
import { loadMealDashboard, loadMealDashboardDetail } from './cloud/mealDashboardRepository'
import { loadAttendeeMealValidations } from './cloud/attendeeMealStatusRepository'
import { getCloudStatus, publishAttendees } from './cloud/publishAttendeesRepository'
import { getFoxBridgeCloudConfigInfo } from './cloud/cloudConfig'
import { getConnectPhoneInfo } from './mobile/connectPhoneRepository'
import { createScannerPairing, getPairingStatus } from './mobile/pairingRepository'

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
  ipcMain.removeHandler('cloud:getStatus')
  ipcMain.handle('cloud:getStatus', async () => getCloudStatus())

  ipcMain.removeHandler('cloud:getConfigInfo')
  ipcMain.handle('cloud:getConfigInfo', async () => getFoxBridgeCloudConfigInfo())

  ipcMain.removeHandler('cloud:getMobileScannerInfo')
  ipcMain.handle('cloud:getMobileScannerInfo', async () => getMobileScannerInfo())

  ipcMain.removeHandler('cloud:getMealDashboard')
  ipcMain.handle('cloud:getMealDashboard', async () => loadMealDashboard())

  ipcMain.removeHandler('cloud:getMealDashboardDetail')
  ipcMain.handle('cloud:getMealDashboardDetail', async (_event, mealKey: string) =>
    loadMealDashboardDetail(mealKey),
  )

  ipcMain.removeHandler('cloud:getAttendeeMealValidations')
  ipcMain.handle('cloud:getAttendeeMealValidations', async (_event, attendeeIds: string[]) =>
    loadAttendeeMealValidations(attendeeIds),
  )

  ipcMain.removeHandler('cloud:publishAttendees')
  ipcMain.handle('cloud:publishAttendees', async (_event, attendees?: Attendee[]) => {
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
    async (_event, payload?: { label?: string | null; ttlMinutes?: number }) =>
      issueFoxBridgeJoinCode(payload),
  )

  ipcMain.removeHandler('cloud:listDesks')
  ipcMain.handle('cloud:listDesks', async () => listFoxBridgeConnectedDesks())

  ipcMain.removeHandler('cloud:revokeDesk')
  ipcMain.handle(
    'cloud:revokeDesk',
    async (_event, payload: { deskDeviceId: string }) =>
      revokeFoxBridgeLinkedDesktop(payload.deskDeviceId),
  )

  ipcMain.removeHandler('cloud:setupMobileScanner')
  ipcMain.handle('cloud:setupMobileScanner', async () => setupMobileScanner())

  ipcMain.removeHandler('cloud:getConnectPhoneInfo')
  ipcMain.handle('cloud:getConnectPhoneInfo', async () => getConnectPhoneInfo())

  ipcMain.removeHandler('cloud:createScannerPairing')
  ipcMain.handle('cloud:createScannerPairing', async () => createScannerPairing())

  ipcMain.removeHandler('cloud:getPairingStatus')
  ipcMain.handle('cloud:getPairingStatus', async (_event, tokenId: string) =>
    getPairingStatus(tokenId),
  )
}
