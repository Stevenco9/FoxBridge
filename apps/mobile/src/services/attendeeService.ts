import { getSupabaseClient } from '../lib/supabaseClient'
import {
  AttendeeLookupError,
  type AttendeeLookupResult,
  type MealEntitlement,
  isValidQrInput,
  normalizeQrInput,
} from '../models/attendee'
import { getMealValidationsForAttendee } from './mealValidationService'

interface AttendeeRow {
  attendee_id: string
  registration_id: string
  display_name: string
  qr_identifier: string
}

interface MealEntitlementRow {
  meal_key: string
  meal_label: string
  source: string
  source_plan_id: string | null
}

function mapEntitlement(row: MealEntitlementRow): MealEntitlement {
  return {
    mealKey: row.meal_key,
    mealLabel: row.meal_label,
    source: row.source,
    sourcePlanId: row.source_plan_id,
  }
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('load failed')
    )
  }

  return false
}

function wrapSupabaseError(error: { message: string }): AttendeeLookupError {
  if (isNetworkFailure(error)) {
    return new AttendeeLookupError(
      'network_unavailable',
      'Network unavailable. Check your connection and try again.',
    )
  }

  return new AttendeeLookupError(
    'network_unavailable',
    'Unable to reach the cloud. Try again in a moment.',
  )
}

async function findAttendeeRow(
  conferenceId: string,
  qrIdentifier: string,
): Promise<AttendeeRow | null> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new AttendeeLookupError(
      'network_unavailable',
      'Supabase is not configured. Check apps/mobile/.env and restart the app.',
    )
  }

  const byQr = await supabase
    .from('attendees')
    .select('attendee_id, registration_id, display_name, qr_identifier')
    .eq('conference_id', conferenceId)
    .eq('qr_identifier', qrIdentifier)
    .maybeSingle()

  if (byQr.error) {
    throw wrapSupabaseError(byQr.error)
  }

  if (byQr.data) {
    return byQr.data as AttendeeRow
  }

  const byAttendeeId = await supabase
    .from('attendees')
    .select('attendee_id, registration_id, display_name, qr_identifier')
    .eq('conference_id', conferenceId)
    .eq('attendee_id', qrIdentifier)
    .maybeSingle()

  if (byAttendeeId.error) {
    throw wrapSupabaseError(byAttendeeId.error)
  }

  return (byAttendeeId.data as AttendeeRow | null) ?? null
}

export async function lookupAttendeeByQrIdentifier(
  conferenceId: string,
  rawQrValue: string,
): Promise<AttendeeLookupResult> {
  const qrIdentifier = normalizeQrInput(rawQrValue)

  if (!isValidQrInput(qrIdentifier)) {
    throw new AttendeeLookupError(
      'invalid_code',
      'That code is empty or invalid. Scan the badge QR or enter the code exactly as printed.',
    )
  }

  if (!conferenceId.trim()) {
    throw new AttendeeLookupError(
      'network_unavailable',
      'No conference is selected. Sign out and choose a conference again.',
    )
  }

  const attendee = await findAttendeeRow(conferenceId, qrIdentifier)
  if (!attendee) {
    throw new AttendeeLookupError(
      'not_found',
      'No attendee found for that badge. Confirm the badge is for this conference and try again.',
    )
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new AttendeeLookupError(
      'network_unavailable',
      'Supabase is not configured. Check apps/mobile/.env and restart the app.',
    )
  }

  const entitlementKey = attendee.qr_identifier
  const { data, error } = await supabase
    .from('meal_entitlements')
    .select('meal_key, meal_label, source, source_plan_id')
    .eq('conference_id', conferenceId)
    .eq('attendee_id', entitlementKey)
    .order('meal_label')

  if (error) {
    throw wrapSupabaseError(error)
  }

  const existingValidations = await getMealValidationsForAttendee(conferenceId, entitlementKey)

  return {
    attendeeId: attendee.attendee_id,
    registrationId: attendee.registration_id,
    displayName: attendee.display_name,
    qrIdentifier: attendee.qr_identifier,
    mealEntitlements: ((data ?? []) as MealEntitlementRow[]).map(mapEntitlement),
    existingValidations,
  }
}
