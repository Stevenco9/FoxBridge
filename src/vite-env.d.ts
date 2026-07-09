/// <reference types="vite/client" />

import type { Attendee } from './shared/models'
import type {
  StoredMealValidation,
  ValidateMealRequest,
  ValidateMealResult,
} from './shared/models/MealValidation'

interface ElectronAPI {
  getAttendees: () => Promise<Attendee[]>
  printBadgePreview: () => Promise<void>
  getMealValidationsForAttendee: (attendeeId: string) => Promise<StoredMealValidation[]>
  validateMeal: (request: ValidateMealRequest) => Promise<ValidateMealResult>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
