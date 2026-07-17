import {
  CHILDREN_MEAL_PATH_TO_CANONICAL,
  getCanonicalMealLabel,
  resolveCanonicalMealServiceId,
} from './canonicalMealOrder'
import { calculatePercentServed } from './aggregateMealDashboard'
import type { MealDashboardValidationInput } from './aggregateMealDashboard'
import type {
  MealDetailAttendeeRow,
  MealDetailData,
  MealDetailServedStatus,
  MealDetailSortMode,
  MealDetailStatusFilter,
  MealDashboardEntitlementSource,
} from '../models/MealDashboard'

export interface MealDetailEntitlementInput {
  attendeeId: string
  mealKey: string
}

export interface BuildMealDetailInput {
  mealKey: string
  entitlements: readonly MealDetailEntitlementInput[]
  validations: readonly MealDashboardValidationInput[]
  attendeeNamesById: ReadonlyMap<string, string>
  scannerLabelsById: ReadonlyMap<string, string>
  entitlementSource: MealDashboardEntitlementSource
  refreshedAt?: string
}

/**
 * Returns stored meal_key values that canonicalize to the selected meal
 * (canonical id plus known child-path aliases). Does not mutate canonical order.
 */
export function mealKeysMatchingCanonical(selectedMealKey: string): string[] {
  const canonical = resolveCanonicalMealServiceId(selectedMealKey)
  const keys = new Set<string>([canonical, selectedMealKey.trim()].filter(Boolean))

  for (const [childPath, parent] of Object.entries(CHILDREN_MEAL_PATH_TO_CANONICAL)) {
    if (parent === canonical) {
      keys.add(childPath)
    }
  }

  return [...keys]
}

function matchesSelectedMeal(mealKey: string, selectedMealKey: string): boolean {
  return resolveCanonicalMealServiceId(mealKey) === resolveCanonicalMealServiceId(selectedMealKey)
}

/**
 * Builds the read-only per-meal attendee report.
 * One row per entitled attendee; duplicate validations collapse to earliest served time.
 */
export function buildMealDetailReport(input: BuildMealDetailInput): MealDetailData {
  const selected = resolveCanonicalMealServiceId(input.mealKey)
  const mealDisplayName = getCanonicalMealLabel(selected)

  const entitledIds = new Set<string>()
  for (const row of input.entitlements) {
    if (!matchesSelectedMeal(row.mealKey, selected)) {
      continue
    }
    const id = row.attendeeId.trim()
    if (id) {
      entitledIds.add(id)
    }
  }

  type Acc = {
    earliestAt: string
    earliestScannerId: string | null
    latestAt: string
    count: number
  }
  const validationsByAttendee = new Map<string, Acc>()

  for (const row of input.validations) {
    if (!matchesSelectedMeal(row.mealKey, selected)) {
      continue
    }
    const id = row.attendeeId.trim()
    if (!id) {
      continue
    }

    const existing = validationsByAttendee.get(id)
    if (!existing) {
      validationsByAttendee.set(id, {
        earliestAt: row.validatedAt,
        earliestScannerId: row.scannerSessionId,
        latestAt: row.validatedAt,
        count: 1,
      })
      continue
    }

    existing.count += 1
    const rowTime = new Date(row.validatedAt).getTime()
    if (rowTime < new Date(existing.earliestAt).getTime()) {
      existing.earliestAt = row.validatedAt
      existing.earliestScannerId = row.scannerSessionId
    }
    if (rowTime > new Date(existing.latestAt).getTime()) {
      existing.latestAt = row.validatedAt
    }
  }

  const attendees: MealDetailAttendeeRow[] = [...entitledIds].map((attendeeId) => {
    const validation = validationsByAttendee.get(attendeeId)
    const name = input.attendeeNamesById.get(attendeeId)?.trim()
    const status: MealDetailServedStatus = validation ? 'served' : 'not_served'

    return {
      attendeeId,
      attendeeDisplayName: name && name.length > 0 ? name : 'Unknown attendee',
      status,
      validatedAt: validation?.earliestAt ?? null,
      scannerLabel: validation?.earliestScannerId
        ? (input.scannerLabelsById.get(validation.earliestScannerId) ?? null)
        : null,
      rawValidationCount: validation?.count ?? 0,
    }
  })

  const totalEntitled = attendees.length
  const totalServed = attendees.filter((row) => row.status === 'served').length
  const totalNotServed = totalEntitled - totalServed

  let mostRecentValidationAt: string | null = null
  for (const [attendeeId, acc] of validationsByAttendee) {
    if (!entitledIds.has(attendeeId)) {
      continue
    }
    if (
      !mostRecentValidationAt ||
      new Date(acc.latestAt).getTime() > new Date(mostRecentValidationAt).getTime()
    ) {
      mostRecentValidationAt = acc.latestAt
    }
  }

  return {
    mealKey: selected,
    mealDisplayName,
    totalEntitled,
    totalServed,
    totalNotServed,
    percentServed: calculatePercentServed(totalServed, totalEntitled),
    mostRecentValidationAt,
    attendees,
    refreshedAt: input.refreshedAt ?? new Date().toISOString(),
    entitlementSource: input.entitlementSource,
  }
}

export function filterMealDetailAttendees(
  attendees: readonly MealDetailAttendeeRow[],
  statusFilter: MealDetailStatusFilter,
  nameQuery: string,
): MealDetailAttendeeRow[] {
  const query = nameQuery.trim().toLowerCase()

  return attendees.filter((row) => {
    if (statusFilter === 'served' && row.status !== 'served') {
      return false
    }
    if (statusFilter === 'not_served' && row.status !== 'not_served') {
      return false
    }
    if (query && !row.attendeeDisplayName.toLowerCase().includes(query)) {
      return false
    }
    return true
  })
}

export function sortMealDetailAttendees(
  attendees: readonly MealDetailAttendeeRow[],
  sortMode: MealDetailSortMode,
): MealDetailAttendeeRow[] {
  const copy = [...attendees]

  copy.sort((left, right) => {
    switch (sortMode) {
      case 'name_asc':
        return left.attendeeDisplayName.localeCompare(right.attendeeDisplayName, undefined, {
          sensitivity: 'base',
        })
      case 'name_desc':
        return right.attendeeDisplayName.localeCompare(left.attendeeDisplayName, undefined, {
          sensitivity: 'base',
        })
      case 'served_newest':
      case 'served_oldest': {
        const leftServed = left.status === 'served' && left.validatedAt
        const rightServed = right.status === 'served' && right.validatedAt
        if (leftServed && rightServed) {
          const delta =
            new Date(left.validatedAt!).getTime() - new Date(right.validatedAt!).getTime()
          return sortMode === 'served_newest' ? -delta : delta
        }
        if (leftServed && !rightServed) {
          return -1
        }
        if (!leftServed && rightServed) {
          return 1
        }
        return left.attendeeDisplayName.localeCompare(right.attendeeDisplayName, undefined, {
          sensitivity: 'base',
        })
      }
      default:
        return 0
    }
  })

  return copy
}
