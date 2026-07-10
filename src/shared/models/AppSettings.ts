export type AppLanguage = 'en' | 'es'

export interface AppSettingsPublic {
  language: AppLanguage
  regfoxEventId: string | null
  conferenceId: string | null
  mobileServiceUrl: string | null
  mobilePublicKey: string | null
  mobileAppUrl: string | null
  /** @deprecated Use mobileAppUrl */
  mobileScannerUrl: string | null
  setupComplete: boolean
  conferenceName: string | null
  lastAttendeeSyncAt: string | null
  showDesktopMealValidation: boolean
  lastMobilePublishWarning: string | null
}

export interface AppSettingsSecrets {
  regfoxApiKey: string | null
  mobileDesktopConnectionKey: string | null
}

export interface SafeStorageStatus {
  available: boolean
  usingFallback: boolean
}

export interface SetupStatus {
  setupComplete: boolean
  regfoxConfigured: boolean
  mobileConfigured: boolean
  mobileConnected: boolean
  attendeeCount: number
  preferredPrinterName: string | null
  printerAvailable: boolean
  conferenceName: string | null
  lastAttendeeUpdate: string | null
  lastMobilePublishAt: string | null
  lastMobilePublishWarning: string | null
  language: AppLanguage
  safeStorage: SafeStorageStatus
}

export interface RegFoxConnectResult {
  success: boolean
  attendeeCount: number
  message: string | null
  publishWarning?: string | null
}

export interface RegFoxUpdateResult {
  success: boolean
  attendeeCount: number
  publishedToMobile: boolean
  publishError: string | null
  message: string | null
}

export interface MobileServiceTestResult {
  success: boolean
  conferenceName: string | null
  message: string | null
}

export interface MobileScannerSetupResult {
  success: boolean
  conferenceName: string | null
  attendeeCount: number
  publishedAt: string | null
  scannerCode: string | null
  scannerLabel: string | null
  mobileScannerUrl: string
  message: string | null
}

export interface PrinterInfoSummary {
  name: string
  isDefault: boolean
}
