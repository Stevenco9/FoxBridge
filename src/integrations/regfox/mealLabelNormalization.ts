/**
 * Accent/case-insensitive RegFox meal label matching for English and Spanish forms.
 * Maps known meal wording onto the existing mealPan.* entitlement keys.
 */

import {
  ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  CHILDREN_MEAL_PATH_TO_CANONICAL,
  COMPLETE_ELEVEN_MEAL_EXPANSION,
  COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  isCompleteMealPackageKey,
  resolveCanonicalMealServiceId,
} from '../../shared/meals/canonicalMealOrder'
import {
  MEAL_PAN_INDIVIDUAL_MEAL_IDS,
  MEAL_PAN_PLAN_IDS,
  MEAL_PLAN_CATEGORY,
  INDIVIDUAL_MEAL_CATEGORY,
} from './mealPurchaseClassification'

export type MealPeriod = 'breakfast' | 'lunch' | 'dinner'

export {
  ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  COMPLETE_ELEVEN_MEAL_EXPANSION,
  COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  isCompleteMealPackageKey,
  resolveCanonicalMealServiceId,
}

const DAY_TOKEN_GROUPS: readonly { dayIndex: number; tokens: readonly string[] }[] = [
  { dayIndex: 0, tokens: ['thursday', 'jueves'] },
  { dayIndex: 1, tokens: ['friday', 'viernes'] },
  { dayIndex: 2, tokens: ['sabbath', 'sabado', 'sábado'] },
]

/** Lunch includes Mexican/Spanish "comida" (midday meal) as well as almuerzo. */
const MEAL_PERIOD_GROUPS: readonly { period: MealPeriod; tokens: readonly string[] }[] = [
  { period: 'breakfast', tokens: ['breakfast', 'desayuno'] },
  { period: 'lunch', tokens: ['lunch', 'almuerzo', 'comida'] },
  { period: 'dinner', tokens: ['dinner', 'cena'] },
]

const DAY_MEAL_TO_CANONICAL_ID: ReadonlyArray<ReadonlyArray<string | null>> = [
  // Thursday: dinner only in the AdAgrA mealPan schedule
  [null, null, 'mealPan.thursdayDinner'],
  // Friday
  ['mealPan.fridayBreakfast', 'mealPan.fridayLunch', 'mealPan.fridayDinner'],
  // Sabbath (RegFox path typo "sabbathLuch" preserved)
  ['mealPan.sabbathBreakfast', 'mealPan.sabbathLuch', 'mealPan.sabbathDinner'],
]

const FULL_PLAN_TOKENS = [
  'full meal plan',
  'fullmealplan',
  'plan completo',
  'plan de comidas completo',
  'plan de comida completo',
  'todas las comidas',
] as const

const HALF_PLAN_TOKENS = [
  'half meal plan',
  'halfmealplan',
  'medio plan',
  'plan medio',
  'media plan',
  'plan de media',
] as const

const OWN_FOOD_TOKENS = [
  'bringing my own',
  'im bringing my own',
  'i am bringing my own',
  'traigo mi propia',
  'traigo mi propio',
  'traer su propia',
  'comida propia',
  'propia comida',
  'sin comidas',
  'sin comida',
] as const

/**
 * Adult à la carte options under the México RegFox multipleChoice field, in service order.
 */
export const COMPLETE_ELEVEN_MEAL_OPTIONS: readonly {
  path: string
  label: string
}[] = [
  { path: 'multipleChoice.meal2', label: 'Cena miércoles' },
  { path: 'multipleChoice.desayunoJueves', label: 'Desayuno jueves' },
  { path: 'multipleChoice.meal3', label: 'Comida jueves' },
  { path: 'multipleChoice.cenaJueves', label: 'Cena jueves' },
  { path: 'multipleChoice.desayunoViernes', label: 'Desayuno viernes' },
  { path: 'multipleChoice.comidaViernes', label: 'Comida viernes' },
  { path: 'multipleChoice.cenaViernes', label: 'Cena viernes' },
  { path: 'multipleChoice.desayunoSabado', label: 'Desayuno sabado' },
  { path: 'multipleChoice.comidaSbado', label: 'Comida sábado' },
  { path: 'multipleChoice.cenaSbado', label: 'Cena sábado' },
  { path: 'multipleChoice.desayunoDomingo', label: 'Desayuno domingo' },
] as const

export function normalizeMealMatchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesNormalizedToken(normalizedLabel: string, token: string): boolean {
  const normalizedToken = normalizeMealMatchText(token)
  if (!normalizedToken) {
    return false
  }
  if (normalizedLabel === normalizedToken) {
    return true
  }

  // Multi-word phrases (e.g. "plan completo") match as contiguous text.
  if (normalizedToken.includes(' ')) {
    return (
      normalizedLabel.startsWith(`${normalizedToken} `) ||
      normalizedLabel.endsWith(` ${normalizedToken}`) ||
      normalizedLabel.includes(` ${normalizedToken} `)
    )
  }

  // Exact whole-word match only — do not treat "comidas" as lunch token "comida".
  const words = normalizedLabel.split(' ').filter(Boolean)
  return words.some((word) => word === normalizedToken)
}

/**
 * Resolves the stable package purchase id for adult or children complete plans.
 */
export function resolveCompleteMealPackageId(path: string, label: string): string | null {
  const trimmedPath = path.trim()
  if (trimmedPath === ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH) {
    return ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH
  }
  if (trimmedPath === CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH) {
    return CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH
  }

  const normalized = normalizeMealMatchText(label)
  if (!normalized || !normalized.includes('11 comidas')) {
    return null
  }

  const looksLikeCompletePlan =
    normalized.includes('plan de alimentacion completo') ||
    normalized.includes('paquete de 11 comidas') ||
    normalized === '11 comidas'

  if (!looksLikeCompletePlan) {
    return null
  }

  if (normalized.includes('para los ninos') || normalized.includes('ninos')) {
    return CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH
  }

  return ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH
}

/**
 * True for the known AdAgrA México adult or children complete 11-meal packages.
 */
export function isCompleteElevenMealPackage(path: string, label: string): boolean {
  return resolveCompleteMealPackageId(path, label) != null
}

/**
 * Expands a complete 11-meal package into individual entitlement ids.
 * Adult and children packages share the same meal-service entitlements.
 * Returns null when the purchase is not a known complete package.
 */
export function expandCompleteMealPackage(
  path: string,
  label: string,
): readonly string[] | null {
  if (!isCompleteElevenMealPackage(path, label)) {
    return null
  }
  return COMPLETE_ELEVEN_MEAL_EXPANSION
}

export function findMealPeriodInLabel(label: string): MealPeriod | null {
  const normalized = normalizeMealMatchText(label)
  if (!normalized) {
    return null
  }

  for (const group of MEAL_PERIOD_GROUPS) {
    if (group.tokens.some((token) => includesNormalizedToken(normalized, token))) {
      return group.period
    }
  }

  return null
}

export function findMealDayIndexInLabel(label: string): number | null {
  const normalized = normalizeMealMatchText(label)
  if (!normalized) {
    return null
  }

  for (const group of DAY_TOKEN_GROUPS) {
    if (group.tokens.some((token) => includesNormalizedToken(normalized, token))) {
      return group.dayIndex
    }
  }

  return null
}

export function labelIndicatesIndividualMeal(label: string): boolean {
  return findMealPeriodInLabel(label) != null
}

function labelMatchesAnyToken(label: string, tokens: readonly string[]): boolean {
  const normalized = normalizeMealMatchText(label)
  return tokens.some((token) => includesNormalizedToken(normalized, token))
}

export function resolveCanonicalPlanIdFromLabel(label: string): string | null {
  if (labelMatchesAnyToken(label, FULL_PLAN_TOKENS)) {
    return 'mealPan.fullMealPlan'
  }
  if (labelMatchesAnyToken(label, HALF_PLAN_TOKENS)) {
    return 'mealPan.halfMealPlan'
  }
  if (labelMatchesAnyToken(label, OWN_FOOD_TOKENS)) {
    return 'mealPan.imBringingMyOwn'
  }
  return null
}

export function labelIndicatesMealPlan(label: string): boolean {
  return resolveCanonicalPlanIdFromLabel(label) != null
}

/**
 * Maps a day + meal-period label onto an existing mealPan.* key when both are present.
 * Returns null for meal-only labels without a conference day (e.g. bare "Almuerzo").
 */
export function resolveCanonicalMealIdFromLabel(label: string): string | null {
  const dayIndex = findMealDayIndexInLabel(label)
  const period = findMealPeriodInLabel(label)
  if (dayIndex == null || period == null) {
    return null
  }

  const periodIndex = period === 'breakfast' ? 0 : period === 'lunch' ? 1 : 2
  const mealId = DAY_MEAL_TO_CANONICAL_ID[dayIndex]?.[periodIndex] ?? null
  if (!mealId || !MEAL_PAN_INDIVIDUAL_MEAL_IDS.has(mealId)) {
    return null
  }

  return mealId
}

export function resolvePurchaseIdentity(
  path: string,
  label: string,
): { id: string; category: string } {
  const trimmedPath = path.trim()
  const trimmedLabel = label.trim()

  if (MEAL_PAN_PLAN_IDS.has(trimmedPath) || trimmedPath.startsWith('meals.')) {
    return {
      id: trimmedPath,
      category: MEAL_PLAN_CATEGORY,
    }
  }

  if (
    MEAL_PAN_INDIVIDUAL_MEAL_IDS.has(trimmedPath) ||
    trimmedPath.startsWith('mealPan.')
  ) {
    const canonicalFromLabel = resolveCanonicalMealIdFromLabel(trimmedLabel)
    return {
      id: canonicalFromLabel ?? trimmedPath,
      category: INDIVIDUAL_MEAL_CATEGORY,
    }
  }

  if (trimmedPath.startsWith('mealChoices.')) {
    return { id: trimmedPath, category: 'mealChoice' }
  }

  const completePackageId = resolveCompleteMealPackageId(trimmedPath, trimmedLabel)
  if (completePackageId) {
    return {
      id: completePackageId,
      category: MEAL_PLAN_CATEGORY,
    }
  }

  // Children's à la carte paths map onto the same meal-service entitlements as adults.
  if (trimmedPath in CHILDREN_MEAL_PATH_TO_CANONICAL) {
    return {
      id: CHILDREN_MEAL_PATH_TO_CANONICAL[trimmedPath]!,
      category: INDIVIDUAL_MEAL_CATEGORY,
    }
  }

  const planId = resolveCanonicalPlanIdFromLabel(trimmedLabel)
  if (planId) {
    return { id: planId, category: MEAL_PLAN_CATEGORY }
  }

  const mealId = resolveCanonicalMealIdFromLabel(trimmedLabel)
  if (mealId) {
    return { id: mealId, category: INDIVIDUAL_MEAL_CATEGORY }
  }

  // Meal term without a resolvable day: keep path, mark as individual meal.
  if (labelIndicatesIndividualMeal(trimmedLabel)) {
    return {
      id: resolveCanonicalMealServiceId(trimmedPath),
      category: INDIVIDUAL_MEAL_CATEGORY,
    }
  }

  return { id: trimmedPath, category: 'registration' }
}
