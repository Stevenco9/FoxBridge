import { getAttendeeFullName } from '../../features/attendees/searchAttendees'
import { getAttendeeQrValue } from '../../features/badge/getAttendeeQrValue'
import { getValidatableMeals } from '../../features/meals/mealValidation'
import type { Attendee } from '../models'
import type { MealDashboardEntitlementInput } from './aggregateMealDashboard'

/**
 * Builds meal entitlement rows from the live RegFox-backed attendee cache.
 * Uses the same getValidatableMeals() rules as cloud publish / door validation.
 */
export function buildEntitlementsFromAttendees(
  attendees: readonly Attendee[],
): MealDashboardEntitlementInput[] {
  const rows: MealDashboardEntitlementInput[] = []

  for (const attendee of attendees) {
    const attendeeId = getAttendeeQrValue(attendee)
    if (!attendeeId) {
      continue
    }

    for (const meal of getValidatableMeals(attendee)) {
      rows.push({
        attendeeId,
        mealKey: meal.id,
      })
    }
  }

  return rows
}

/** Display-name lookup keyed by QR / registration / id for dashboard recent scans. */
export function buildAttendeeNameMap(
  attendees: readonly Attendee[],
): Map<string, string> {
  const names = new Map<string, string>()

  for (const attendee of attendees) {
    const name = getAttendeeFullName(attendee).trim()
    if (!name) {
      continue
    }

    const qr = getAttendeeQrValue(attendee)
    if (qr) {
      names.set(qr, name)
    }
    if (attendee.id) {
      names.set(attendee.id, name)
    }
    if (attendee.registrationId) {
      names.set(attendee.registrationId, name)
    }
  }

  return names
}
