/**
 * Thin re-exports around the shared canonical meal order.
 * Prefer buildMealDisplayModel for anything that feeds React.
 */

import {
  getCanonicalMealOrderIndex,
  isCompleteMealPackageKey,
  normalizeAndSortMealEntitlements,
  sortMealsByCanonicalOrder,
} from '../../../../src/shared/meals/canonicalMealOrder.ts'

export interface ChronologicalMealSortInput {
  mealKey: string
  mealLabel: string
}

const UNRECOGNIZED_SORT_BASE = 1_000

export function resolveChronologicalOrderIndex(mealKey: string, mealLabel: string): number {
  return getCanonicalMealOrderIndex(mealKey, mealLabel) ?? UNRECOGNIZED_SORT_BASE
}

export function sortMealsChronologically<T extends ChronologicalMealSortInput>(
  meals: T[],
): T[] {
  return sortMealsByCanonicalOrder(
    meals.filter((meal) => !isCompleteMealPackageKey(meal.mealKey)),
  )
}

export function normalizeMobileMealEntitlements<T extends ChronologicalMealSortInput>(
  meals: T[],
): T[] {
  return normalizeAndSortMealEntitlements(meals)
}
