import { sortMealsChronologically } from '../utils/mealOrder'

export type MealDisplayStatus =
  | 'available'
  | 'validating'
  | 'validated'
  | 'already_validated'
  | 'error'

export interface StoredMealValidation {
  mealKey: string
  mealLabel: string
  validatedAt: string
}

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

export interface MealRowState {
  mealKey: string
  mealLabel: string
  source: string
  status: MealDisplayStatus
  validatedAt: string | null
  errorMessage: string | null
}

export function buildInitialMealRowStates(
  entitlements: Array<{ mealKey: string; mealLabel: string; source: string }>,
  existingValidations: StoredMealValidation[],
): MealRowState[] {
  const validatedByKey = new Map(
    existingValidations.map((validation) => [validation.mealKey, validation]),
  )

  return sortMealsChronologically(entitlements).map((meal) => {
    const existing = validatedByKey.get(meal.mealKey)
    if (existing) {
      return {
        mealKey: meal.mealKey,
        mealLabel: meal.mealLabel,
        source: meal.source,
        status: 'already_validated',
        validatedAt: existing.validatedAt,
        errorMessage: null,
      }
    }

    return {
      mealKey: meal.mealKey,
      mealLabel: meal.mealLabel,
      source: meal.source,
      status: 'available',
      validatedAt: null,
      errorMessage: null,
    }
  })
}
