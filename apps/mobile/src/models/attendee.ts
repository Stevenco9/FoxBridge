export interface MealEntitlement {
  mealKey: string
  mealLabel: string
  source: string
  sourcePlanId: string | null
}

export interface AttendeeLookupResult {
  attendeeId: string
  registrationId: string
  displayName: string
  qrIdentifier: string
  mealEntitlements: MealEntitlement[]
  existingValidations: Array<{
    mealKey: string
    mealLabel: string
    validatedAt: string
  }>
}

export type AttendeeLookupErrorCode =
  | 'camera_denied'
  | 'camera_unavailable'
  | 'invalid_code'
  | 'not_found'
  | 'network_unavailable'

export class AttendeeLookupError extends Error {
  readonly code: AttendeeLookupErrorCode

  constructor(code: AttendeeLookupErrorCode, message: string) {
    super(message)
    this.name = 'AttendeeLookupError'
    this.code = code
  }
}

export function normalizeQrInput(value: string): string {
  return value.trim()
}

export function isValidQrInput(value: string): boolean {
  return normalizeQrInput(value).length > 0
}
