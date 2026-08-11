import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettingsPublic,
  MobileScannerSetupResult,
  MobileServiceTestResult,
  PrinterInfoSummary,
  RegFoxConnectResult,
  RegFoxUpdateResult,
  SetupStatus,
} from '../src/shared/models/AppSettings'
import type { Attendee } from '../src/shared/models'
import type { AttendeeCheckInResult } from '../src/shared/models/AttendeeCheckIn'
import type {
  StoredMealValidation,
  ValidateMealRequest,
  ValidateMealResult,
} from '../src/shared/models/MealValidation'
import type { CloudStatus, PublishAttendeesResult } from '../src/shared/models/CloudStatus'
import type { FoxBridgeCloudConfigInfo } from '../src/shared/models/CloudConfig'
import type { MealDashboardResult, MealDetailResult } from '../src/shared/models/MealDashboard'
import type { AttendeeMealValidationsResult } from '../src/shared/models/AttendeeMealStatus'
import type {
  BadgePrintStatus,
} from '../src/shared/models/BadgePrintLog'
import type { PairingInfo, PairingStatus } from '../src/shared/models/PairingInfo'
import type { ConnectPhoneInfo } from '../src/shared/models/ConnectPhoneInfo'
import type { MobileScannerInfo } from '../src/shared/models/MobileScannerInfo'
import type { ScannerServerStatus } from '../src/shared/models/ScannerServer'
import type {
  EventSettingsEntry,
  EventSettingsPatch,
} from '../src/shared/models/EventSettings'

const electronAPI = {
  getAttendees: (): Promise<Attendee[]> => ipcRenderer.invoke('regfox:getAttendees'),
  connectRegFox: (payload: { apiKey: string; eventId: string }): Promise<RegFoxConnectResult> =>
    ipcRenderer.invoke('regfox:connect', payload),
  updateRegistrations: (): Promise<RegFoxUpdateResult> =>
    ipcRenderer.invoke('regfox:updateRegistrations'),
  checkInAttendee: (attendeeId: string): Promise<AttendeeCheckInResult> =>
    ipcRenderer.invoke('regfox:checkInAttendee', attendeeId),
  printBadgePreview: (attendeeId: string): Promise<void> =>
    ipcRenderer.invoke('print:badgePreview', attendeeId),
  printTestBadge: (): Promise<void> => ipcRenderer.invoke('print:testBadge'),
  getBadgePrintStatus: (attendeeId: string): Promise<BadgePrintStatus> =>
    ipcRenderer.invoke('print:getBadgePrintStatus', attendeeId),
  listPrinters: (): Promise<PrinterInfoSummary[]> => ipcRenderer.invoke('print:listPrinters'),
  getPreferredPrinter: (): Promise<string | null> => ipcRenderer.invoke('print:getPreferredPrinter'),
  setPreferredPrinter: (printerName: string): Promise<string | null> =>
    ipcRenderer.invoke('print:setPreferredPrinter', printerName),
  getMealValidationsForAttendee: (attendeeId: string): Promise<StoredMealValidation[]> =>
    ipcRenderer.invoke('meals:getValidationsForAttendee', attendeeId),
  validateMeal: (request: ValidateMealRequest): Promise<ValidateMealResult> =>
    ipcRenderer.invoke('meals:validateMeal', request),
  getScannerServerStatus: (): Promise<ScannerServerStatus> =>
    ipcRenderer.invoke('scannerServer:getStatus'),
  startScannerServer: (port?: number): Promise<ScannerServerStatus> =>
    ipcRenderer.invoke('scannerServer:start', port),
  stopScannerServer: (): Promise<ScannerServerStatus> =>
    ipcRenderer.invoke('scannerServer:stop'),
  getCloudStatus: (): Promise<CloudStatus> => ipcRenderer.invoke('cloud:getStatus'),
  getFoxBridgeCloudConfigInfo: (): Promise<FoxBridgeCloudConfigInfo> =>
    ipcRenderer.invoke('cloud:getConfigInfo'),
  getMealDashboard: (): Promise<MealDashboardResult> =>
    ipcRenderer.invoke('cloud:getMealDashboard'),
  getMealDashboardDetail: (mealKey: string): Promise<MealDetailResult> =>
    ipcRenderer.invoke('cloud:getMealDashboardDetail', mealKey),
  getAttendeeMealValidations: (attendeeIds: string[]): Promise<AttendeeMealValidationsResult> =>
    ipcRenderer.invoke('cloud:getAttendeeMealValidations', attendeeIds),
  getMobileScannerInfo: (): Promise<MobileScannerInfo> =>
    ipcRenderer.invoke('cloud:getMobileScannerInfo'),
  publishAttendees: (): Promise<PublishAttendeesResult> =>
    ipcRenderer.invoke('cloud:publishAttendees'),
  testMobileService: (payload: {
    serviceUrl: string
    publicKey: string
    desktopConnectionKey: string
    conferenceId?: string | null
  }): Promise<MobileServiceTestResult> => ipcRenderer.invoke('cloud:testMobileService', payload),
  enrollFoxBridgeCloudDesktop: (payload: {
    enrollmentCode: string
    label?: string | null
  }): Promise<{
    success: boolean
    conferenceId: string | null
    conferenceName: string | null
    message: string | null
  }> => ipcRenderer.invoke('cloud:enrollDesktop', payload),
  setupMobileScanner: (): Promise<MobileScannerSetupResult> =>
    ipcRenderer.invoke('cloud:setupMobileScanner'),
  getConnectPhoneInfo: (): Promise<ConnectPhoneInfo> =>
    ipcRenderer.invoke('cloud:getConnectPhoneInfo'),
  createScannerPairing: (): Promise<PairingInfo> =>
    ipcRenderer.invoke('cloud:createScannerPairing'),
  getPairingStatus: (tokenId: string): Promise<PairingStatus> =>
    ipcRenderer.invoke('cloud:getPairingStatus', tokenId),
  initializeSettings: (): Promise<AppSettingsPublic> => ipcRenderer.invoke('settings:initialize'),
  getPublicSettings: (): Promise<AppSettingsPublic> => ipcRenderer.invoke('settings:getPublic'),
  savePublicSettings: (patch: Partial<AppSettingsPublic>): Promise<AppSettingsPublic> =>
    ipcRenderer.invoke('settings:savePublic', patch),
  saveSettingsSecrets: (patch: {
    regfoxApiKey?: string | null
    mobileDesktopConnectionKey?: string | null
  }): Promise<void> => ipcRenderer.invoke('settings:saveSecrets', patch),
  getSetupStatus: (): Promise<SetupStatus> => ipcRenderer.invoke('settings:getSetupStatus'),
  completeSetup: (): Promise<AppSettingsPublic> => ipcRenderer.invoke('settings:completeSetup'),
  resetSetup: (): Promise<AppSettingsPublic> => ipcRenderer.invoke('settings:resetSetup'),
  getEventSettings: (eventId: string): Promise<EventSettingsEntry> =>
    ipcRenderer.invoke('eventSettings:get', eventId),
  patchEventSettings: (
    eventId: string,
    patch: EventSettingsPatch,
  ): Promise<EventSettingsEntry> => ipcRenderer.invoke('eventSettings:patch', eventId, patch),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
