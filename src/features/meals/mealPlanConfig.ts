/**
 * Central meal plan expansion config for FoxBridge meal validation.
 * Derived from RegFox form descriptions for the AdAgrA-style mealPan field.
 */

import {
  ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  CANONICAL_MEAL_SERVICE_LABELS,
  CANONICAL_MEAL_SERVICE_ORDER,
  CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH,
  COMPLETE_ELEVEN_MEAL_EXPANSION,
  getCanonicalMealLabel,
} from '../../shared/meals/canonicalMealOrder'

export interface ValidatableMeal {
  id: string
  name: string
  source: 'individual' | 'mealPlan'
  /** Present when the meal was included via a meal plan expansion. */
  sourcePlanId?: string
}

/** Canonical individual meal purchase ids and display labels. */
export const VALIDATABLE_MEAL_DEFINITIONS: Record<string, string> = {
  ...CANONICAL_MEAL_SERVICE_LABELS,
  // English test-page labels retained for mealPan keys when not overridden above.
  // México Spanish labels from CANONICAL_MEAL_SERVICE_LABELS take precedence for shared keys.
}

/** Display order for validatable meals on badges and validation UI. */
export const VALIDATABLE_MEAL_ORDER: readonly string[] = CANONICAL_MEAL_SERVICE_ORDER

/** English AdAgrA test-page full plan: Thursday dinner through Sabbath dinner. */
const FULL_MEAL_PLAN_MEALS: readonly string[] = [
  'mealPan.thursdayDinner',
  'mealPan.fridayBreakfast',
  'mealPan.fridayLunch',
  'mealPan.fridayDinner',
  'mealPan.sabbathBreakfast',
  'mealPan.sabbathLuch',
  'mealPan.sabbathDinner',
]

/** RegFox description: "Thursday Dinner- Friday Dinner" */
const HALF_MEAL_PLAN_MEALS: readonly string[] = [
  'mealPan.thursdayDinner',
  'mealPan.fridayBreakfast',
  'mealPan.fridayLunch',
  'mealPan.fridayDinner',
]

/**
 * Maps meal plan purchase ids to included individual meal purchase ids.
 * RegFox descriptions:
 * - Full Meal Plan: "All 7 meals, Thursday Dinner to Sabbath Dinner"
 * - Half Meal plan: "Thursday Dinner- Friday Dinner"
 * - Im bringing my own food: "No meals during the conference"
 * - México complete packages (adult + children): same 11 meal services
 */
export const MEAL_PLAN_EXPANSIONS: Record<string, readonly string[]> = {
  'mealPan.fullMealPlan': FULL_MEAL_PLAN_MEALS,
  'mealPan.halfMealPlan': HALF_MEAL_PLAN_MEALS,
  'mealPan.imBringingMyOwn': [],
  'meals.session1': FULL_MEAL_PLAN_MEALS,
  'meals.session2': HALF_MEAL_PLAN_MEALS,
  'meals.session3': [],
  [ADULT_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH]: COMPLETE_ELEVEN_MEAL_EXPANSION,
  [CHILDREN_COMPLETE_ELEVEN_MEAL_PACKAGE_PATH]: COMPLETE_ELEVEN_MEAL_EXPANSION,
}

export function getMealDisplayName(mealId: string): string {
  return getCanonicalMealLabel(mealId) || VALIDATABLE_MEAL_DEFINITIONS[mealId] || mealId
}
