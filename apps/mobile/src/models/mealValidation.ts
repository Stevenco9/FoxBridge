export type {
  MealDisplayStatus,
  MealRowState,
  StoredMealValidation,
} from './mealDisplayModel'

export {
  buildMealDisplayModel,
  describeMealDisplayOrder,
} from './mealDisplayModel'

/** @deprecated Use buildMealDisplayModel */
export { buildMealDisplayModel as buildInitialMealRowStates } from './mealDisplayModel'

export interface ValidateMealRequest {
  conferenceId: string
  attendeeId: string
  mealKey: string
  mealLabel: string
  scannerSessionId: string | null
}

export type ValidateMealStatus = 'created' | 'already_exists'

export interface ValidateMealResult {
  status: ValidateMealStatus
  mealKey: string
  mealLabel: string
  validatedAt: string
}

export class MealValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MealValidationError'
  }
}
