/**
 * Central meal plan expansion config for FoxBridge meal validation.
 * Derived from RegFox form descriptions for the AdAgrA-style mealPan field.
 */

export interface ValidatableMeal {
  id: string
  name: string
  source: 'individual' | 'mealPlan'
  /** Present when the meal was included via a meal plan expansion. */
  sourcePlanId?: string
}

/** Canonical individual meal purchase ids and display labels. */
export const VALIDATABLE_MEAL_DEFINITIONS: Record<string, string> = {
  'mealPan.thursdayDinner': 'Thursday dinner',
  'mealPan.fridayBreakfast': 'Friday breakfast',
  'mealPan.fridayLunch': 'Friday lunch',
  'mealPan.fridayDinner': 'Friday Dinner',
  'mealPan.sabbathBreakfast': 'Sabbath breakfast',
  'mealPan.sabbathLuch': 'Sabbath luch',
  'mealPan.sabbathDinner': 'Sabbath Dinner',
}

/** Display order for validatable meals on badges and validation UI. */
export const VALIDATABLE_MEAL_ORDER: readonly string[] = [
  'mealPan.thursdayDinner',
  'mealPan.fridayBreakfast',
  'mealPan.fridayLunch',
  'mealPan.fridayDinner',
  'mealPan.sabbathBreakfast',
  'mealPan.sabbathLuch',
  'mealPan.sabbathDinner',
]

const FULL_MEAL_PLAN_MEALS: readonly string[] = [...VALIDATABLE_MEAL_ORDER]

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
 */
export const MEAL_PLAN_EXPANSIONS: Record<string, readonly string[]> = {
  'mealPan.fullMealPlan': FULL_MEAL_PLAN_MEALS,
  'mealPan.halfMealPlan': HALF_MEAL_PLAN_MEALS,
  'mealPan.imBringingMyOwn': [],
  'meals.session1': FULL_MEAL_PLAN_MEALS,
  'meals.session2': HALF_MEAL_PLAN_MEALS,
  'meals.session3': [],
}

export function getMealDisplayName(mealId: string): string {
  return VALIDATABLE_MEAL_DEFINITIONS[mealId] ?? mealId
}
