import {
  CANONICAL_MEAL_SERVICE_ORDER,
  getCanonicalMealLabel,
  resolveCanonicalMealServiceId,
  sortMealsByCanonicalOrder,
} from './canonicalMealOrder'
import type {
  MealDashboardMealRow,
  MealDashboardRecentScan,
  MealDashboardSummary,
} from '../models/MealDashboard'

/** Raw validation row used for aggregation (no PII beyond display name resolution). */
export interface MealDashboardValidationInput {
  attendeeId: string
  mealKey: string
  mealLabel: string
  validatedAt: string
  scannerSessionId: string | null
}

export interface MealDashboardEntitlementInput {
  attendeeId: string
  mealKey: string
}

export interface MealDashboardAggregateInput {
  validations: readonly MealDashboardValidationInput[]
  entitlements: readonly MealDashboardEntitlementInput[]
  /** Map of cloud attendee_id (QR) → display_name */
  attendeeNamesById: ReadonlyMap<string, string>
  /** Map of scanner_sessions.id → label */
  scannerLabelsById: ReadonlyMap<string, string>
  recentLimit?: number
}

export interface MealDashboardAggregateResult {
  summary: MealDashboardSummary
  meals: MealDashboardMealRow[]
  recentScans: MealDashboardRecentScan[]
}

/**
 * Percent served for a meal. Returns null when entitled count is missing or zero.
 */
export function calculatePercentServed(
  validatedCount: number,
  entitledCount: number | null,
): number | null {
  if (entitledCount == null || entitledCount <= 0) {
    return null
  }

  return Math.round((validatedCount / entitledCount) * 1000) / 10
}

function countDistinctAttendees(
  validations: readonly MealDashboardValidationInput[],
): number {
  const ids = new Set<string>()
  for (const row of validations) {
    const id = row.attendeeId.trim()
    if (id) {
      ids.add(id)
    }
  }
  return ids.size
}

/**
 * Pure aggregation for the Meal Dashboard. Safe to unit-test without Supabase.
 */
export function aggregateMealDashboard(
  input: MealDashboardAggregateInput,
): MealDashboardAggregateResult {
  const recentLimit = input.recentLimit ?? 25
  const validatedByMeal = new Map<string, { count: number; mostRecentAt: string | null }>()
  const entitledByMeal = new Map<string, number>()

  for (const row of input.validations) {
    const mealKey = resolveCanonicalMealServiceId(row.mealKey)
    if (!mealKey) {
      continue
    }

    const current = validatedByMeal.get(mealKey) ?? { count: 0, mostRecentAt: null }
    current.count += 1
    if (
      !current.mostRecentAt ||
      new Date(row.validatedAt).getTime() > new Date(current.mostRecentAt).getTime()
    ) {
      current.mostRecentAt = row.validatedAt
    }
    validatedByMeal.set(mealKey, current)
  }

  for (const row of input.entitlements) {
    const mealKey = resolveCanonicalMealServiceId(row.mealKey)
    if (!mealKey) {
      continue
    }
    entitledByMeal.set(mealKey, (entitledByMeal.get(mealKey) ?? 0) + 1)
  }

  const mealKeys = new Set<string>([
    ...CANONICAL_MEAL_SERVICE_ORDER,
    ...validatedByMeal.keys(),
    ...entitledByMeal.keys(),
  ])

  const mealRowsUnsorted: MealDashboardMealRow[] = [...mealKeys].map((mealKey) => {
    const validated = validatedByMeal.get(mealKey)
    const entitledCount = entitledByMeal.has(mealKey)
      ? (entitledByMeal.get(mealKey) ?? 0)
      : 0
    const validatedCount = validated?.count ?? 0

    return {
      mealKey,
      mealDisplayName: getCanonicalMealLabel(mealKey),
      validatedCount,
      entitledCount,
      percentServed: calculatePercentServed(validatedCount, entitledCount),
      mostRecentValidationAt: validated?.mostRecentAt ?? null,
    }
  })

  const meals = sortMealsByCanonicalOrder(
    mealRowsUnsorted.map((row) => ({
      mealKey: row.mealKey,
      mealLabel: row.mealDisplayName,
      row,
    })),
  ).map((entry) => entry.row)

  let mostRecentValidationAt: string | null = null
  for (const row of input.validations) {
    if (
      !mostRecentValidationAt ||
      new Date(row.validatedAt).getTime() > new Date(mostRecentValidationAt).getTime()
    ) {
      mostRecentValidationAt = row.validatedAt
    }
  }

  const summary: MealDashboardSummary = {
    totalValidations: input.validations.length,
    distinctAttendeesServed: countDistinctAttendees(input.validations),
    mealsWithValidations: [...validatedByMeal.values()].filter((entry) => entry.count > 0)
      .length,
    mostRecentValidationAt,
  }

  const recentScans: MealDashboardRecentScan[] = [...input.validations]
    .sort(
      (left, right) =>
        new Date(right.validatedAt).getTime() - new Date(left.validatedAt).getTime(),
    )
    .slice(0, recentLimit)
    .map((row) => {
      const mealKey = resolveCanonicalMealServiceId(row.mealKey)
      const name = input.attendeeNamesById.get(row.attendeeId.trim())?.trim()
      return {
        attendeeDisplayName: name && name.length > 0 ? name : 'Unknown attendee',
        mealDisplayName: getCanonicalMealLabel(mealKey) || row.mealLabel,
        validatedAt: row.validatedAt,
        scannerLabel: row.scannerSessionId
          ? (input.scannerLabelsById.get(row.scannerSessionId) ?? null)
          : null,
      }
    })

  return { summary, meals, recentScans }
}
