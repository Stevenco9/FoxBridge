/** FoxBridge purchase categories for meal-related RegFox field paths. */
export const MEAL_PLAN_CATEGORY = 'mealPlan'
export const INDIVIDUAL_MEAL_CATEGORY = 'individualMeal'
export const MEAL_CHOICE_CATEGORY = 'mealChoice'

/** AdAgrA-style full/half/bring-your-own plans under mealPan.* */
export const MEAL_PAN_PLAN_IDS = new Set([
  'mealPan.fullMealPlan',
  'mealPan.halfMealPlan',
  'mealPan.imBringingMyOwn',
])

/** AdAgrA-style à la carte meals validated individually. */
export const MEAL_PAN_INDIVIDUAL_MEAL_IDS = new Set([
  'mealPan.thursdayDinner',
  'mealPan.fridayBreakfast',
  'mealPan.fridayLunch',
  'mealPan.fridayDinner',
  'mealPan.sabbathBreakfast',
  'mealPan.sabbathLuch',
  'mealPan.sabbathDinner',
])

export function classifyPurchaseCategory(purchaseId: string): string {
  if (purchaseId.startsWith('mealChoices.')) {
    return MEAL_CHOICE_CATEGORY
  }

  if (purchaseId.startsWith('meals.')) {
    return MEAL_PLAN_CATEGORY
  }

  if (MEAL_PAN_PLAN_IDS.has(purchaseId)) {
    return MEAL_PLAN_CATEGORY
  }

  if (MEAL_PAN_INDIVIDUAL_MEAL_IDS.has(purchaseId)) {
    return INDIVIDUAL_MEAL_CATEGORY
  }

  if (purchaseId.startsWith('mealPan.')) {
    return INDIVIDUAL_MEAL_CATEGORY
  }

  return 'registration'
}

export function isMealRelatedCategory(category: string | undefined): boolean {
  return (
    category === MEAL_PLAN_CATEGORY ||
    category === INDIVIDUAL_MEAL_CATEGORY ||
    category === MEAL_CHOICE_CATEGORY ||
    category === 'meal'
  )
}
