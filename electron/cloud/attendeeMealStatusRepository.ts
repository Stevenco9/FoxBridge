import { resolveConferenceId } from './conferenceRepository'
import { getSupabaseServiceClient } from './supabaseClient'
import type { AttendeeMealValidationsResult } from '../../src/shared/models/AttendeeMealStatus'

interface ValidationRow {
  meal_key: string
  meal_label: string
  validated_at: string
  scanner_session_id: string | null
}

interface ScannerLabelRow {
  id: string
  label: string
}

/**
 * Loads Supabase meal validations for one attendee (QR identifier and/or local id).
 * Read-only; scoped to the active conference.
 */
export async function loadAttendeeMealValidations(
  attendeeIds: string[],
): Promise<AttendeeMealValidationsResult> {
  const ids = [...new Set(attendeeIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) {
    return {
      success: false,
      error: 'Missing attendee identifier for meal status lookup.',
    }
  }

  const client = getSupabaseServiceClient()
  if (!client) {
    return {
      success: true,
      data: {
        validations: [],
        cloudAvailable: false,
      },
    }
  }

  const conference = await resolveConferenceId(false)
  if (!conference) {
    return {
      success: true,
      data: {
        validations: [],
        cloudAvailable: false,
      },
    }
  }

  const { data: validationData, error: validationError } = await client
    .from('meal_validations')
    .select('meal_key, meal_label, validated_at, scanner_session_id')
    .eq('conference_id', conference.id)
    .in('attendee_id', ids)

  if (validationError) {
    return {
      success: false,
      error: `Unable to load meal validations: ${validationError.message}`,
    }
  }

  const validations = (validationData ?? []) as ValidationRow[]
  const scannerIds = [
    ...new Set(
      validations
        .map((row) => row.scanner_session_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ]

  const scannerLabelsById = new Map<string, string>()
  if (scannerIds.length > 0) {
    const { data: scannerData, error: scannerError } = await client
      .from('scanner_sessions')
      .select('id, label')
      .eq('conference_id', conference.id)
      .in('id', scannerIds)

    if (scannerError) {
      return {
        success: false,
        error: `Unable to load scanner labels: ${scannerError.message}`,
      }
    }

    for (const row of (scannerData ?? []) as ScannerLabelRow[]) {
      if (row.id && row.label) {
        scannerLabelsById.set(row.id, row.label)
      }
    }
  }

  return {
    success: true,
    data: {
      cloudAvailable: true,
      validations: validations.map((row) => ({
        mealKey: row.meal_key,
        mealLabel: row.meal_label,
        validatedAt: row.validated_at,
        scannerLabel: row.scanner_session_id
          ? (scannerLabelsById.get(row.scanner_session_id) ?? null)
          : null,
      })),
    },
  }
}
