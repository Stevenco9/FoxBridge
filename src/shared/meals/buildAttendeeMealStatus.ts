import {
  getCanonicalMealLabel,
  resolveCanonicalMealServiceId,
} from './canonicalMealOrder'
import type {
  AttendeeMealStatusRow,
  AttendeeMealStatusSummary,
  AttendeeMealServedStatus,
} from '../models/AttendeeMealStatus'

export interface AttendeeMealEntitlementInput {
  id: string
  name: string
  source: 'individual' | 'mealPlan'
}

export interface AttendeeMealValidationInput {
  mealKey: string
  validatedAt: string
  scannerLabel?: string | null
}

export interface BuildAttendeeMealStatusInput {
  entitledMeals: readonly AttendeeMealEntitlementInput[]
  validations: readonly AttendeeMealValidationInput[]
}

export interface AttendeeMealStatusReport {
  rows: AttendeeMealStatusRow[]
  summary: AttendeeMealStatusSummary
}

/**
 * Builds one row per purchased/entitled meal with Served / Not Served status.
 * Duplicate validations for the same canonical meal collapse to the earliest time.
 */
export function buildAttendeeMealStatusReport(
  input: BuildAttendeeMealStatusInput,
): AttendeeMealStatusReport {
  type Acc = {
    earliestAt: string
    scannerLabel: string | null
  }
  const validationsByMeal = new Map<string, Acc>()

  for (const row of input.validations) {
    const mealKey = resolveCanonicalMealServiceId(row.mealKey)
    if (!mealKey) {
      continue
    }

    const existing = validationsByMeal.get(mealKey)
    if (!existing) {
      validationsByMeal.set(mealKey, {
        earliestAt: row.validatedAt,
        scannerLabel: row.scannerLabel ?? null,
      })
      continue
    }

    if (new Date(row.validatedAt).getTime() < new Date(existing.earliestAt).getTime()) {
      existing.earliestAt = row.validatedAt
      existing.scannerLabel = row.scannerLabel ?? null
    }
  }

  const seen = new Set<string>()
  const rows: AttendeeMealStatusRow[] = []

  for (const meal of input.entitledMeals) {
    const mealKey = resolveCanonicalMealServiceId(meal.id)
    if (!mealKey || seen.has(mealKey)) {
      continue
    }
    seen.add(mealKey)

    const validation = validationsByMeal.get(mealKey)
    const status: AttendeeMealServedStatus = validation ? 'served' : 'not_served'

    rows.push({
      mealKey,
      mealDisplayName: getCanonicalMealLabel(mealKey) || meal.name,
      status,
      validatedAt: validation?.earliestAt ?? null,
      scannerLabel: validation?.scannerLabel ?? null,
      source: meal.source,
    })
  }

  const totalPurchased = rows.length
  const totalServed = rows.filter((row) => row.status === 'served').length

  return {
    rows,
    summary: {
      totalPurchased,
      totalServed,
      totalNotServed: totalPurchased - totalServed,
    },
  }
}
