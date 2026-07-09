export interface StoredMealValidation {
  mealKey: string
  mealLabel: string
  validatedAt: string
  validatedBy: string | null
}

export interface ValidateMealRequest {
  attendeeId: string
  mealKey: string
  mealLabel: string
  validatedBy?: string | null
}

export interface ValidateMealResult {
  status: 'created' | 'already_exists'
  validation: StoredMealValidation
}
