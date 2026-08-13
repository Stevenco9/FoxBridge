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
import type { FoxBridgeCloudConfigInfo } from './shared/models/CloudConfig'
import type { MealDashboardResult, MealDetailResult } from './shared/models/MealDashboard'
import type { AttendeeMealValidationsResult } from './shared/models/AttendeeMealStatus'
import type { BadgePrintStatus } from './shared/models/BadgePrintLog'
import type { ConnectPhoneInfo } from './shared/models/ConnectPhoneInfo'
import type { PairingInfo, PairingStatus } from './shared/models/PairingInfo'
import type { MobileScannerInfo } from './shared/models/MobileScannerInfo'
import type { ScannerServerStatus } from './shared/models/ScannerServer'
import type {
  EventSettingsEntry,
  EventSettingsPatch,
} from './shared/models/EventSettings'
import type { EventAccessStatus } from './shared/models/EventAccessSession'

interface ElectronAPI {
  getAttendees: () => Promise<Attendee[]>
  connectRegFox: (payload: { apiKey: string; eventId: string }) => Promise<RegFoxConnectResult>
  updateRegistrations: () => Promise<RegFoxUpdateResult>
  checkInAttendee: (attendeeId: string) => Promise<AttendeeCheckInResult>
  onAttendeesChanged: (callback: () => void) => () => void
  printBadgePreview: (attendeeId: string) => Promise<void>
  printTestBadge: () => Promise<void>
  getBadgePrintStatus: (attendeeId: string) => Promise<BadgePrintStatus>
  listPrinters: () => Promise<PrinterInfoSummary[]>
  getPreferredPrinter: () => Promise<string | null>
  setPreferredPrinter: (printerName: string) => Promise<string | null>
  getMealValidationsForAttendee: (attendeeId: string) => Promise<StoredMealValidation[]>
  validateMeal: (request: ValidateMealRequest) => Promise<ValidateMealResult>
  getScannerServerStatus: () => Promise<ScannerServerStatus>
  startScannerServer: (port?: number) => Promise<ScannerServerStatus>
  stopScannerServer: () => Promise<ScannerServerStatus>
  getCloudStatus: () => Promise<CloudStatus>
  getFoxBridgeCloudConfigInfo: () => Promise<FoxBridgeCloudConfigInfo>
  getEventAccessStatus: () => Promise<EventAccessStatus>
  lockEventAccess: () => Promise<EventAccessStatus>
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
  enrollFoxBridgeCloudDesktop: (payload: {
    enrollmentCode: string
    label?: string | null
  }) => Promise<{
    success: boolean
    conferenceId: string | null
    conferenceName: string | null
    message: string | null
  }>
  claimFoxBridgeCloudPrincipal: (payload?: {
    label?: string | null
    confirmTransfer?: boolean
    ownershipRegFoxApiKey?: string | null
    ownershipRegFoxEventId?: string | null
  }) => Promise<{
    success: boolean
    conferenceId: string | null
    conferenceName: string | null
    transferred: boolean
    needsTransferConfirmation: boolean
    message: string | null
  }>
  redeemFoxBridgeLinkedJoin: (payload: {
    joinCode: string
    label?: string | null
  }) => Promise<{
    success: boolean
    conferenceId: string | null
    conferenceName: string | null
    expiresAt: string | null
    message: string | null
  }>
  issueFoxBridgeJoinCode: (payload?: {
    label?: string | null
    ttlMinutes?: number
  }) => Promise<{
    joinCode: string
    joinCodeId: string
    conferenceId: string
    expiresAt: string
    ttlMinutes: number
  }>
  listFoxBridgeConnectedDesks: () => Promise<{
    conferenceId: string
    desks: Array<{
      id: string
      label: string | null
      role: string
      createdAt: string
      expiresAt: string | null
      revokedAt: string | null
      lastUsedAt: string | null
      isCurrent: boolean
    }>
  }>
  getUpstreamCheckInHealth: () => Promise<{
    conferenceId: string
    pending: number
    failedRetryable: number
    terminalOrExhausted: number
    notApplicable: number
    synced: number
    oldestWaitingAt: string | null
  } | null>
  revokeFoxBridgeLinkedDesktop: (payload: {
    deskDeviceId: string
  }) => Promise<{ deskDeviceId: string; revokedAt: string }>
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
  getEventSettings: (eventId: string) => Promise<EventSettingsEntry>
  patchEventSettings: (
    eventId: string,
    patch: EventSettingsPatch,
  ) => Promise<EventSettingsEntry>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
