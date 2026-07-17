/**
 * Read-only per-attendee meal purchase vs validation status.
 */

export type AttendeeMealServedStatus = 'served' | 'not_served'

export interface AttendeeMealStatusRow {
  mealKey: string
  mealDisplayName: string
  status: AttendeeMealServedStatus
  /** Earliest successful validation time when served. */
  validatedAt: string | null
  scannerLabel: string | null
  source: 'individual' | 'mealPlan'
}

export interface AttendeeMealStatusSummary {
  totalPurchased: number
  totalServed: number
  totalNotServed: number
}

export interface AttendeeCloudMealValidation {
  mealKey: string
  mealLabel: string
  validatedAt: string
  scannerLabel: string | null
}

export type AttendeeMealValidationsResult =
  | {
      success: true
      data: {
        validations: AttendeeCloudMealValidation[]
        /** False when Supabase is not configured; local validations may still apply. */
        cloudAvailable: boolean
      }
    }
  | { success: false; error: string }
