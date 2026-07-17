/**
 * Read-only Meal Dashboard result shapes (Sprint 18A).
 * Validations come from Supabase; entitlements prefer the live RegFox attendee cache.
 */

export type MealDashboardEntitlementSource = 'regfox_cache' | 'supabase_fallback'

export interface MealDashboardSummary {
  totalValidations: number
  distinctAttendeesServed: number
  mealsWithValidations: number
  mostRecentValidationAt: string | null
}

export interface MealDashboardMealRow {
  mealKey: string
  mealDisplayName: string
  validatedCount: number
  /**
   * People currently entitled to this meal from RegFox mapping (preferred)
   * or from the last Supabase publish (fallback).
   */
  entitledCount: number | null
  /**
   * validatedCount / entitledCount * 100, rounded to one decimal.
   * null when entitledCount is null or zero (avoid divide-by-zero).
   */
  percentServed: number | null
  mostRecentValidationAt: string | null
}

export interface MealDashboardRecentScan {
  attendeeDisplayName: string
  mealDisplayName: string
  validatedAt: string
  /** scanner_sessions.label when scanner_session_id is present. */
  scannerLabel: string | null
}

export interface MealDashboardData {
  conferenceId: string
  conferenceName: string
  summary: MealDashboardSummary
  meals: MealDashboardMealRow[]
  recentScans: MealDashboardRecentScan[]
  refreshedAt: string
  /** Where entitled counts were computed from. */
  entitlementSource: MealDashboardEntitlementSource
}

export type MealDashboardResult =
  | { success: true; data: MealDashboardData }
  | { success: false; error: string }
