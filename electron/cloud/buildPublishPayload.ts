import { getAttendeeFullName } from '../../src/features/attendees/searchAttendees'
import { getAttendeeQrValue } from '../../src/features/badge/getAttendeeQrValue'
import { getValidatableMeals } from '../../src/features/meals/mealValidation'
import type { Attendee } from '../../src/shared/models'
import {
  OPERATIONAL_SNAPSHOT_VERSION,
  buildOperationalJsonV1,
} from '../../src/shared/attendees/operationalAttendeeSnapshot'

export interface PublishAttendeeRow {
  conference_id: string
  attendee_id: string
  registration_id: string
  display_name: string
  email: string
  qr_identifier: string
  updated_at: string
  phone: string | null
  organization: string | null
  job_title: string | null
  department: string | null
  confirmation_code: string | null
  payment_status: string | null
  payment_total: number | null
  payment_paid: number | null
  payment_balance: number | null
  payment_currency: string | null
  payment_upstream_status: string | null
  checked_in: boolean
  checked_in_at: string | null
  snapshot_version: number
  operational_json: ReturnType<typeof buildOperationalJsonV1>
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
  const payment = attendee.payment

  return {
    attendee: {
      conference_id: conferenceId,
      attendee_id: attendee.id,
      registration_id: attendee.registrationId,
      display_name: getAttendeeFullName(attendee) || 'Unnamed attendee',
      email: attendee.email,
      qr_identifier: qrIdentifier,
      updated_at: publishedAt,
      phone: attendee.phone?.trim() || null,
      organization: attendee.organization?.trim() || null,
      job_title: attendee.jobTitle?.trim() || null,
      department: attendee.department?.trim() || null,
      confirmation_code: attendee.confirmationCode?.trim() || null,
      payment_status: payment?.status ?? 'unknown',
      payment_total: payment?.totalAmount ?? null,
      payment_paid: payment?.amountPaid ?? null,
      payment_balance: payment?.balanceDue ?? null,
      payment_currency: payment?.currency ?? null,
      payment_upstream_status: payment?.upstreamStatus ?? null,
      checked_in: Boolean(attendee.checkedIn),
      checked_in_at: attendee.checkedInAt?.trim() || null,
      snapshot_version: OPERATIONAL_SNAPSHOT_VERSION,
      operational_json: buildOperationalJsonV1(attendee),
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
