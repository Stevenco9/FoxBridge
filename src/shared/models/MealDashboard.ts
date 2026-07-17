/**
 * Read-only Meal Dashboard result shapes (Sprint 18A / 18B).
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
  /** Distinct canonical validated meal keys, indexed by attendee QR identifier. */
  attendeeValidatedMealKeys: Record<string, string[]>
  refreshedAt: string
  /** Where entitled counts were computed from. */
  entitlementSource: MealDashboardEntitlementSource
}

export type MealDashboardResult =
  | { success: true; data: MealDashboardData }
  | { success: false; error: string }

/** Sprint 18B — per-meal attendee report */

export type MealDetailServedStatus = 'served' | 'not_served'

export type MealDetailStatusFilter = 'all' | 'served' | 'not_served'

export type MealDetailSortMode =
  | 'name_asc'
  | 'name_desc'
  | 'served_newest'
  | 'served_oldest'

export interface MealDetailAttendeeRow {
  attendeeId: string
  attendeeDisplayName: string
  status: MealDetailServedStatus
  /** Earliest successful validation time when served. */
  validatedAt: string | null
  scannerLabel: string | null
  /** Raw validation rows collapsed into this attendee (diagnostics only). */
  rawValidationCount: number
}

export interface MealDetailData {
  mealKey: string
  mealDisplayName: string
  totalEntitled: number
  totalServed: number
  totalNotServed: number
  percentServed: number | null
  mostRecentValidationAt: string | null
  attendees: MealDetailAttendeeRow[]
  refreshedAt: string
  entitlementSource: MealDashboardEntitlementSource
}

export type MealDetailResult =
  | { success: true; data: MealDetailData }
  | { success: false; error: string }
