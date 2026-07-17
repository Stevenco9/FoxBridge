/// <reference types="vite/client" />

import type {
  AppSettingsPublic,
  MobileScannerSetupResult,
  MobileServiceTestResult,
  PrinterInfoSummary,
  RegFoxConnectResult,
  RegFoxUpdateResult,
  SetupStatus,
} from './shared/models/AppSettings'
import type { Attendee } from './shared/models'
import type { AttendeeCheckInResult } from './shared/models/AttendeeCheckIn'
import type {
  StoredMealValidation,
  ValidateMealRequest,
  ValidateMealResult,
} from './shared/models/MealValidation'
import type { CloudStatus, PublishAttendeesResult } from './shared/models/CloudStatus'
import type { MealDashboardResult, MealDetailResult } from './shared/models/MealDashboard'
import type { AttendeeMealValidationsResult } from './shared/models/AttendeeMealStatus'
import type { ConnectPhoneInfo } from './shared/models/ConnectPhoneInfo'
import type { PairingInfo, PairingStatus } from './shared/models/PairingInfo'
import type { MobileScannerInfo } from './shared/models/MobileScannerInfo'
import type { ScannerServerStatus } from './shared/models/ScannerServer'

interface ElectronAPI {
  getAttendees: () => Promise<Attendee[]>
  connectRegFox: (payload: { apiKey: string; eventId: string }) => Promise<RegFoxConnectResult>
  updateRegistrations: () => Promise<RegFoxUpdateResult>
  checkInAttendee: (attendeeId: string) => Promise<AttendeeCheckInResult>
  printBadgePreview: () => Promise<void>
  printTestBadge: () => Promise<void>
  listPrinters: () => Promise<PrinterInfoSummary[]>
  getPreferredPrinter: () => Promise<string | null>
  setPreferredPrinter: (printerName: string) => Promise<string | null>
  getMealValidationsForAttendee: (attendeeId: string) => Promise<StoredMealValidation[]>
  validateMeal: (request: ValidateMealRequest) => Promise<ValidateMealResult>
  getScannerServerStatus: () => Promise<ScannerServerStatus>
  startScannerServer: (port?: number) => Promise<ScannerServerStatus>
  stopScannerServer: () => Promise<ScannerServerStatus>
  getCloudStatus: () => Promise<CloudStatus>
  getMealDashboard: () => Promise<MealDashboardResult>
  getMealDashboardDetail: (mealKey: string) => Promise<MealDetailResult>
  getAttendeeMealValidations: (attendeeIds: string[]) => Promise<AttendeeMealValidationsResult>
  getMobileScannerInfo: () => Promise<MobileScannerInfo>
  publishAttendees: () => Promise<PublishAttendeesResult>
  testMobileService: (payload: {
    serviceUrl: string
    publicKey: string
    desktopConnectionKey: string
    conferenceId?: string | null
  }) => Promise<MobileServiceTestResult>
  setupMobileScanner: () => Promise<MobileScannerSetupResult>
  getConnectPhoneInfo: () => Promise<ConnectPhoneInfo>
  createScannerPairing: () => Promise<PairingInfo>
  getPairingStatus: (tokenId: string) => Promise<PairingStatus>
  initializeSettings: () => Promise<AppSettingsPublic>
  getPublicSettings: () => Promise<AppSettingsPublic>
  savePublicSettings: (patch: Partial<AppSettingsPublic>) => Promise<AppSettingsPublic>
  saveSettingsSecrets: (patch: {
    regfoxApiKey?: string | null
    mobileDesktopConnectionKey?: string | null
  }) => Promise<void>
  getSetupStatus: () => Promise<SetupStatus>
  completeSetup: () => Promise<AppSettingsPublic>
  resetSetup: () => Promise<AppSettingsPublic>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
