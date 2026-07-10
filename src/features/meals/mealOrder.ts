import {
  getCanonicalMealOrderIndex,
  sortMealsByCanonicalOrder,
} from '../../shared/meals/canonicalMealOrder'

export interface ChronologicalMealSortInput {
  mealKey: string
  mealLabel: string
}

const UNRECOGNIZED_SORT_BASE = 1_000

/**
 * Canonical entitlement ID is the primary ordering key.
 * Labels are ignored for known ids (legacy fallback only inside shared sorter).
 */
export function resolveChronologicalOrderIndex(mealKey: string, mealLabel: string): number {
  return getCanonicalMealOrderIndex(mealKey, mealLabel) ?? UNRECOGNIZED_SORT_BASE
}

export function compareMealsChronologically(
  left: ChronologicalMealSortInput,
  right: ChronologicalMealSortInput,
): number {
  const leftIndex = resolveChronologicalOrderIndex(left.mealKey, left.mealLabel)
  const rightIndex = resolveChronologicalOrderIndex(right.mealKey, right.mealLabel)

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex
  }

  return left.mealLabel.localeCompare(right.mealLabel, undefined, { sensitivity: 'base' })
}

export function sortMealsChronologically<T extends ChronologicalMealSortInput>(
  meals: T[],
): T[] {
  return sortMealsByCanonicalOrder(meals)
}
