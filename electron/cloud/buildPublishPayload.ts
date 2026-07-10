import { getAttendeeFullName } from '../../src/features/attendees/searchAttendees'
import { getAttendeeQrValue } from '../../src/features/badge/getAttendeeQrValue'
import { getValidatableMeals } from '../../src/features/meals/mealValidation'
import type { Attendee } from '../../src/shared/models'

export interface PublishAttendeeRow {
  conference_id: string
  attendee_id: string
  registration_id: string
  display_name: string
  email: string
  qr_identifier: string
  updated_at: string
}

export interface PublishMealEntitlementRow {
  conference_id: string
  attendee_id: string
  meal_key: string
  meal_label: string
  source: string
  source_plan_id: string | null
  updated_at: string
}

export interface AttendeePublishPayload {
  attendee: PublishAttendeeRow
  mealEntitlements: PublishMealEntitlementRow[]
}

export function buildAttendeePublishPayload(
  attendee: Attendee,
  conferenceId: string,
  publishedAt: string,
): AttendeePublishPayload {
  const qrIdentifier = getAttendeeQrValue(attendee)
  const validatableMeals = getValidatableMeals(attendee)

  return {
    attendee: {
      conference_id: conferenceId,
      attendee_id: attendee.id,
      registration_id: attendee.registrationId,
      display_name: getAttendeeFullName(attendee) || 'Unnamed attendee',
      email: attendee.email,
      qr_identifier: qrIdentifier,
      updated_at: publishedAt,
    },
    mealEntitlements: validatableMeals.map((meal) => ({
      conference_id: conferenceId,
      attendee_id: qrIdentifier,
      meal_key: meal.id,
      meal_label: meal.name,
      source: meal.source,
      source_plan_id: meal.sourcePlanId ?? null,
      updated_at: publishedAt,
    })),
  }
}
