/**
 * Shared canonical meal-service order for AdAgrA México (desktop + mobile).
 * IDs match live RegFox à la carte entitlements after label normalization.
 *
 * Ordering must use entitlement ID only. Labels are display-only (legacy fallback).
 */

/** Adult complete package — RegFox path `multipleChoice.meal1`. */
export const ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH = 'multipleChoice.meal1'

/** Children complete package — RegFox path `planDeAlimentacinPara.planDeAlimentacinCompleto`. */
export const CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH =
  'planDeAlimentacinPara.planDeAlimentacinCompleto'

export const COMPLETE_MEAL_PACKAGE_PATHS = new Set<string>([
  ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
])

/**
 * Chronological meal-service order for the conference.
 * Mixed `multipleChoice.*` and `mealPan.*` ids — do not sort by prefix or alphabet.
 */
export const CANONICAL_MEAL_SERVICE_ORDER: readonly string[] = [
  'multipleChoice.meal2',
  'multipleChoice.desayunoJueves',
  'multipleChoice.meal3',
  'mealPan.thursdayDinner',
  'mealPan.fridayBreakfast',
  'mealPan.fridayLunch',
  'mealPan.fridayDinner',
  'mealPan.sabbathBreakfast',
  'mealPan.sabbathLuch',
  'mealPan.sabbathDinner',
  'multipleChoice.desayunoDomingo',
] as const

/** Display labels aligned to the México RegFox à la carte options. */
export const CANONICAL_MEAL_SERVICE_LABELS: Readonly<Record<string, string>> = {
  'multipleChoice.meal2': 'Cena miércoles',
  'multipleChoice.desayunoJueves': 'Desayuno jueves',
  'multipleChoice.meal3': 'Comida jueves',
  'mealPan.thursdayDinner': 'Cena jueves',
  'mealPan.fridayBreakfast': 'Desayuno viernes',
  'mealPan.fridayLunch': 'Comida viernes',
  'mealPan.fridayDinner': 'Cena viernes',
  'mealPan.sabbathBreakfast': 'Desayuno sábado',
  'mealPan.sabbathLuch': 'Comida sábado',
  'mealPan.sabbathDinner': 'Cena sábado',
  'multipleChoice.desayunoDomingo': 'Desayuno domingo',
}

/**
 * Children's à la carte RegFox paths → same meal-service entitlements as adult options.
 * Also used to sort/dedupe legacy Supabase rows published under child paths.
 */
export const CHILDREN_MEAL_PATH_TO_CANONICAL: Readonly<Record<string, string>> = {
  'planDeAlimentacinPara.cenaMircoles': 'multipleChoice.meal2',
  'planDeAlimentacinPara.desayunoJueves': 'multipleChoice.desayunoJueves',
  'planDeAlimentacinPara.comidaJueves': 'multipleChoice.meal3',
  'planDeAlimentacinPara.cenaJueves': 'mealPan.thursdayDinner',
  'planDeAlimentacinPara.desayunoViernes': 'mealPan.fridayBreakfast',
  'planDeAlimentacinPara.comidaViernes': 'mealPan.fridayLunch',
  'planDeAlimentacinPara.cenaViernes': 'mealPan.fridayDinner',
  'planDeAlimentacinPara.desayunoSbado': 'mealPan.sabbathBreakfast',
  'planDeAlimentacinPara.desayunoSabado': 'mealPan.sabbathBreakfast',
  'planDeAlimentacinPara.comidaSbado': 'mealPan.sabbathLuch',
  'planDeAlimentacinPara.cenaSbado': 'mealPan.sabbathDinner',
  'planDeAlimentacinPara.desayunoDomingo': 'multipleChoice.desayunoDomingo',
}

/** @deprecated Prefer ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH */
export const COMPLETE_ELEVEN_MEAL_PACKAGE_PATH = ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH

/** Expansion list shared by adult and children complete packages. */
export const COMPLETE_ELEVEN_MEAL_EXPANSION: readonly string[] = CANONICAL_MEAL_SERVICE_ORDER

const CANONICAL_ORDER_INDEX = new Map<string, number>(
  CANONICAL_MEAL_SERVICE_ORDER.map((mealId, index) => [mealId, index]),
)

const NORMALIZED_LABEL_TO_ORDER_INDEX = new Map<string, number>()
for (const [mealId, label] of Object.entries(CANONICAL_MEAL_SERVICE_LABELS)) {
  const index = CANONICAL_ORDER_INDEX.get(mealId)
  if (index === undefined) {
    continue
  }
  NORMALIZED_LABEL_TO_ORDER_INDEX.set(normalizeMealLabel(label), index)
}

const UNRECOGNIZED_SORT_BASE = 1_000

function normalizeMealLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isCompleteMealPackageKey(mealId: string): boolean {
  return COMPLETE_MEAL_PACKAGE_PATHS.has(mealId.trim())
}

/**
 * Maps a stored/RegFox meal id onto the canonical meal-service id when known.
 * Unknown ids are returned unchanged.
 */
export function resolveCanonicalMealServiceId(mealId: string): string {
  const trimmed = mealId.trim()
  if (!trimmed) {
    return trimmed
  }
  if (CANONICAL_ORDER_INDEX.has(trimmed)) {
    return trimmed
  }
  return CHILDREN_MEAL_PATH_TO_CANONICAL[trimmed] ?? trimmed
}

export function getCanonicalMealOrderIndex(
  mealId: string,
  mealLabel?: string,
): number | null {
  const resolved = resolveCanonicalMealServiceId(mealId)
  const index = CANONICAL_ORDER_INDEX.get(resolved)
  if (index !== undefined) {
    return index
  }

  // Legacy fallback only: known display labels when the stored id is unrecognized.
  if (mealLabel) {
    const fromLabel = NORMALIZED_LABEL_TO_ORDER_INDEX.get(normalizeMealLabel(mealLabel))
    if (fromLabel !== undefined) {
      return fromLabel
    }
  }

  return null
}

export function getCanonicalMealLabel(mealId: string): string {
  const resolved = resolveCanonicalMealServiceId(mealId)
  return CANONICAL_MEAL_SERVICE_LABELS[resolved] ?? mealId
}

export function compareCanonicalMealIds(leftId: string, rightId: string): number {
  const leftIndex = getCanonicalMealOrderIndex(leftId)
  const rightIndex = getCanonicalMealOrderIndex(rightId)

  if (leftIndex != null && rightIndex != null) {
    return leftIndex - rightIndex
  }
  if (leftIndex != null) {
    return -1
  }
  if (rightIndex != null) {
    return 1
  }
  return resolveCanonicalMealServiceId(leftId).localeCompare(
    resolveCanonicalMealServiceId(rightId),
  )
}

export interface CanonicalMealSortInput {
  mealKey: string
  mealLabel?: string
}

/**
 * Primary ordering key = canonical entitlement ID.
 * Labels are display-only and used only when the id is unrecognized (legacy rows).
 * Stable: equal keys preserve original relative order.
 */
export function sortMealsByCanonicalOrder<T extends CanonicalMealSortInput>(
  meals: readonly T[],
): T[] {
  return meals
    .map((meal, index) => ({ meal, index }))
    .sort((left, right) => {
      const leftIndex =
        getCanonicalMealOrderIndex(left.meal.mealKey, left.meal.mealLabel) ??
        UNRECOGNIZED_SORT_BASE
      const rightIndex =
        getCanonicalMealOrderIndex(right.meal.mealKey, right.meal.mealLabel) ??
        UNRECOGNIZED_SORT_BASE

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex
      }

      return left.index - right.index
    })
    .map(({ meal }) => meal)
}

/**
 * Dedupes entitlements by canonical meal-service id, preferring already-canonical keys,
 * then sorts into canonical chronological order. Filters complete-package keys.
 */
export function normalizeAndSortMealEntitlements<
  T extends { mealKey: string; mealLabel: string },
>(meals: readonly T[]): T[] {
  const byCanonicalId = new Map<string, T>()

  for (const meal of meals) {
    if (isCompleteMealPackageKey(meal.mealKey)) {
      continue
    }

    const canonicalId = resolveCanonicalMealServiceId(meal.mealKey)
    const existing = byCanonicalId.get(canonicalId)
    const mealIsCanonical = meal.mealKey.trim() === canonicalId

    if (!existing) {
      byCanonicalId.set(canonicalId, {
        ...meal,
        mealKey: canonicalId,
        mealLabel: getCanonicalMealLabel(canonicalId) || meal.mealLabel,
      })
      continue
    }

    if (mealIsCanonical && existing.mealKey !== canonicalId) {
      byCanonicalId.set(canonicalId, {
        ...meal,
        mealKey: canonicalId,
        mealLabel: getCanonicalMealLabel(canonicalId) || meal.mealLabel,
      })
    }
  }

  return sortMealsByCanonicalOrder([...byCanonicalId.values()])
}
