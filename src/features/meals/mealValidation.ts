import type { Attendee, AttendeeCustomField, AttendeePurchase } from '../../shared/models'
import {
  INDIVIDUAL_MEAL_CATEGORY,
  MEAL_CHOICE_CATEGORY,
  MEAL_PLAN_CATEGORY,
} from '../../integrations/regfox/mealPurchaseClassification'
import { getAttendeeFullName } from '../attendees/searchAttendees'
import {
  MEAL_PLAN_EXPANSIONS,
  VALIDATABLE_MEAL_ORDER,
  getMealDisplayName,
  type ValidatableMeal,
} from './mealPlanConfig'

export type { ValidatableMeal } from './mealPlanConfig'

const LEGACY_MEAL_PLAN_CATEGORY = 'meal'

export function findAttendeeByQrValue(
  attendees: Attendee[],
  qrValue: string,
): Attendee | null {
  const normalized = qrValue.trim()
  if (!normalized) {
    return null
  }

  return (
    attendees.find(
      (attendee) =>
        attendee.id === normalized || attendee.registrationId === normalized,
    ) ?? null
  )
}

export function getMealPlanPurchases(purchases: AttendeePurchase[]): AttendeePurchase[] {
  return purchases.filter(
    (purchase) =>
      purchase.category === MEAL_PLAN_CATEGORY ||
      purchase.category === LEGACY_MEAL_PLAN_CATEGORY,
  )
}

export function getIndividualMealPurchases(
  purchases: AttendeePurchase[],
): AttendeePurchase[] {
  return purchases.filter((purchase) => purchase.category === INDIVIDUAL_MEAL_CATEGORY)
}

/**
 * Returns deduplicated individual meals the attendee may validate, combining
 * explicit à la carte selections and meals included through meal plans.
 */
export function getValidatableMeals(attendee: Attendee): ValidatableMeal[] {
  const byId = new Map<string, ValidatableMeal>()

  for (const purchase of getIndividualMealPurchases(attendee.purchases)) {
    byId.set(purchase.id, {
      id: purchase.id,
      name: purchase.name,
      source: 'individual',
    })
  }

  for (const plan of getMealPlanPurchases(attendee.purchases)) {
    const expandedMealIds = MEAL_PLAN_EXPANSIONS[plan.id] ?? []

    for (const mealId of expandedMealIds) {
      if (byId.has(mealId)) {
        continue
      }

      byId.set(mealId, {
        id: mealId,
        name: getMealDisplayName(mealId),
        source: 'mealPlan',
        sourcePlanId: plan.id,
      })
    }
  }

  const orderedIds = [
    ...VALIDATABLE_MEAL_ORDER.filter((mealId) => byId.has(mealId)),
    ...[...byId.keys()].filter((mealId) => !VALIDATABLE_MEAL_ORDER.includes(mealId)),
  ]

  return orderedIds.map((mealId) => byId.get(mealId)!)
}

export function getMealChoicePurchase(
  purchases: AttendeePurchase[],
): AttendeePurchase | undefined {
  return purchases.find((purchase) => purchase.category === MEAL_CHOICE_CATEGORY)
}

export function getMealChoiceLabel(purchases: AttendeePurchase[]): string | null {
  return getMealChoicePurchase(purchases)?.name ?? null
}

export function buildMealValidationKey(attendeeId: string, mealPurchaseId: string): string {
  return `${attendeeId}:${mealPurchaseId}`
}

export function isMealValidated(
  validatedMealKeys: Set<string>,
  attendeeId: string,
  mealPurchaseId: string,
): boolean {
  return validatedMealKeys.has(buildMealValidationKey(attendeeId, mealPurchaseId))
}

function getCustomFieldValue(
  customFields: AttendeeCustomField[],
  key: string,
): string | null {
  const field = customFields.find((item) => item.key === key)
  if (field?.value == null) {
    return null
  }

  const value = String(field.value).trim()
  return value || null
}

export interface DietaryRestrictionInfo {
  hasRestriction: boolean | null
  description: string | null
}

export function getDietaryRestrictionInfo(
  customFields: AttendeeCustomField[],
): DietaryRestrictionInfo {
  const restrictionAnswer = getCustomFieldValue(customFields, 'doYouHaveAn')
  const description = getCustomFieldValue(customFields, 'pleaseDescribe')

  if (!restrictionAnswer) {
    return {
      hasRestriction: null,
      description,
    }
  }

  const normalized = restrictionAnswer.toLowerCase()
  if (normalized === 'yes') {
    return { hasRestriction: true, description }
  }

  if (normalized === 'no') {
    return { hasRestriction: false, description: null }
  }

  return { hasRestriction: null, description }
}

export function formatAttendeeDisplayName(attendee: Attendee): string {
  return getAttendeeFullName(attendee) || 'Unnamed attendee'
}

export function formatDietaryRestriction(info: DietaryRestrictionInfo): string {
  if (info.hasRestriction == null) {
    return 'Not provided'
  }

  if (info.hasRestriction) {
    return info.description ? `Yes — ${info.description}` : 'Yes'
  }

  return 'No'
}
