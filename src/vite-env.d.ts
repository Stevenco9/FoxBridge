/// <reference types="vite/client" />

import type { Attendee } from './shared/models'
import type {
  StoredMealValidation,
  ValidateMealRequest,
  ValidateMealResult,
} from './shared/models/MealValidation'
import type { CloudStatus, PublishAttendeesResult } from './shared/models/CloudStatus'
import type { ScannerServerStatus } from './shared/models/ScannerServer'

interface ElectronAPI {
  getAttendees: () => Promise<Attendee[]>
  printBadgePreview: () => Promise<void>
  getMealValidationsForAttendee: (attendeeId: string) => Promise<StoredMealValidation[]>
  validateMeal: (request: ValidateMealRequest) => Promise<ValidateMealResult>
  getScannerServerStatus: () => Promise<ScannerServerStatus>
  startScannerServer: (port?: number) => Promise<ScannerServerStatus>
  stopScannerServer: () => Promise<ScannerServerStatus>
  getCloudStatus: () => Promise<CloudStatus>
  publishAttendees: () => Promise<PublishAttendeesResult>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
