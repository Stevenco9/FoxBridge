export type AppLanguage = 'en' | 'es'

export interface AppSettingsPublic {
  language: AppLanguage
  /**
   * RegFox page/form id for the current RegFox integration.
   * Kept for existing RegFox workflows; prefer `activeEventId` for new
   * FoxBridge event-scoped associations.
   */
  regfoxEventId: string | null
  /**
   * Active FoxBridge Event id (`events.id`). Maps to the current registration
   * platform event (e.g. RegFox via `events.platform_event_id`).
   */
  activeEventId: string | null
  conferenceId: string | null
  /**
   * FoxBridge Cloud endpoint URL (legacy field name). Prefer packaged
   * FoxBridge Cloud public defaults for ordinary installs; Advanced override
   * for development / migration.
   */
  mobileServiceUrl: string | null
  /** Publishable Cloud client key (legacy field name; never a service-role). */
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
  /**
   * Privileged Desktop Cloud key (legacy name). Local secrets / developer env
   * only — never packaged into distributed builds. Target: move privileged
   * Cloud ops behind a FoxBridge API / Edge Function.
   */
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
