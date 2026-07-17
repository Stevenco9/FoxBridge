import { ipcMain } from 'electron'
import type { Attendee } from '../src/shared/models'
import { getMobileScannerInfo } from './cloud/mobileScannerInfoRepository'
import { loadMealDashboard } from './cloud/mealDashboardRepository'
import { getCloudStatus, publishAttendees } from './cloud/publishAttendeesRepository'
import { getConnectPhoneInfo } from './mobile/connectPhoneRepository'
import { createScannerPairing, getPairingStatus } from './mobile/pairingRepository'

import {
  setupMobileScanner,
  testMobileService,
} from './settings/settingsService'

export function registerCloudHandlers(): void {
  ipcMain.removeHandler('cloud:getStatus')
  ipcMain.handle('cloud:getStatus', async () => getCloudStatus())

  ipcMain.removeHandler('cloud:getMobileScannerInfo')
  ipcMain.handle('cloud:getMobileScannerInfo', async () => getMobileScannerInfo())

  ipcMain.removeHandler('cloud:getMealDashboard')
  ipcMain.handle('cloud:getMealDashboard', async () => loadMealDashboard())

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
