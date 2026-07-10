/**
 * Single mobile meal display pipeline.
 * Raw Supabase-style rows → normalize/dedupe/sort → status enrichment → React list.
 * Validation status must never change chronological order.
 */

import {
  CANONICAL_MEAL_SERVICE_ORDER,
  getCanonicalMealOrderIndex,
  normalizeAndSortMealEntitlements,
  resolveCanonicalMealServiceId,
} from '../../../../src/shared/meals/canonicalMealOrder.ts'

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

export interface MealRowState {
  mealKey: string
  mealLabel: string
  source: string
  status: MealDisplayStatus
  validatedAt: string | null
  errorMessage: string | null
}

export interface RawMealEntitlementRow {
  mealKey: string
  mealLabel: string
  source: string
  sourcePlanId?: string | null
}

export { CANONICAL_MEAL_SERVICE_ORDER, getCanonicalMealOrderIndex, resolveCanonicalMealServiceId }

/**
 * Builds the exact array rendered by AttendeeLookupResultView.
 * This is the only ordering step between Supabase and React `.map()`.
 */
export function buildMealDisplayModel(
  rawEntitlements: readonly RawMealEntitlementRow[],
  existingValidations: readonly StoredMealValidation[] = [],
): MealRowState[] {
  const ordered = normalizeAndSortMealEntitlements(
    rawEntitlements.map((meal) => ({
      mealKey: meal.mealKey,
      mealLabel: meal.mealLabel,
      source: meal.source,
      sourcePlanId: meal.sourcePlanId ?? null,
    })),
  )

  const validatedByKey = new Map(
    existingValidations.map((validation) => [
      resolveCanonicalMealServiceId(validation.mealKey),
      validation,
    ]),
  )

  return ordered.map((meal) => {
    const existing = validatedByKey.get(meal.mealKey)
    const status: MealDisplayStatus = existing ? 'already_validated' : 'available'

    return {
      mealKey: meal.mealKey,
      mealLabel: meal.mealLabel,
      source: meal.source,
      status,
      validatedAt: existing?.validatedAt ?? null,
      errorMessage: null,
    }
  })
}

/** Trace helper for debugging display order (dev / tests). */
export function describeMealDisplayOrder(meals: readonly MealRowState[]) {
  return meals.map((meal, index) => ({
    index,
    id: meal.mealKey,
    label: meal.mealLabel,
    normalizedId: resolveCanonicalMealServiceId(meal.mealKey),
    canonicalOrder: getCanonicalMealOrderIndex(meal.mealKey, meal.mealLabel),
    status: meal.status,
  }))
}
