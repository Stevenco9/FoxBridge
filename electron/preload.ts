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
import type {
  StoredMealValidation,
  ValidateMealRequest,
  ValidateMealResult,
} from '../src/shared/models/MealValidation'
import type { CloudStatus, PublishAttendeesResult } from '../src/shared/models/CloudStatus'
import type { PairingInfo, PairingStatus } from '../src/shared/models/PairingInfo'
import type { ConnectPhoneInfo } from '../src/shared/models/ConnectPhoneInfo'
import type { MobileScannerInfo } from '../src/shared/models/MobileScannerInfo'
import type { ScannerServerStatus } from '../src/shared/models/ScannerServer'

const electronAPI = {
  getAttendees: (): Promise<Attendee[]> => ipcRenderer.invoke('regfox:getAttendees'),
  connectRegFox: (payload: { apiKey: string; eventId: string }): Promise<RegFoxConnectResult> =>
    ipcRenderer.invoke('regfox:connect', payload),
  updateRegistrations: (): Promise<RegFoxUpdateResult> =>
    ipcRenderer.invoke('regfox:updateRegistrations'),
  printBadgePreview: (): Promise<void> => ipcRenderer.invoke('print:badgePreview'),
  printTestBadge: (): Promise<void> => ipcRenderer.invoke('print:testBadge'),
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
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
