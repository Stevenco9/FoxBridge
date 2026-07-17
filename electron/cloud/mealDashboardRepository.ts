import { resolveConferenceId } from './conferenceRepository'
import { getSupabaseServiceClient } from './supabaseClient'
import { getAttendeeCache, isAttendeeCacheLoaded } from '../scannerServer/attendeeCache'
import { aggregateMealDashboard } from '../../src/shared/meals/aggregateMealDashboard'
import {
  buildMealDetailReport,
  mealKeysMatchingCanonical,
} from '../../src/shared/meals/buildMealDetailReport'
import { resolveCanonicalMealServiceId } from '../../src/shared/meals/canonicalMealOrder'
import {
  buildAttendeeNameMap,
  buildEntitlementsFromAttendees,
} from '../../src/shared/meals/buildLiveMealEntitlements'
import type { MealDashboardResult, MealDetailResult } from '../../src/shared/models/MealDashboard'

interface ValidationRow {
  attendee_id: string
  meal_key: string
  meal_label: string
  validated_at: string
  scanner_session_id: string | null
}

interface EntitlementRow {
  attendee_id: string
  meal_key: string
}

interface AttendeeNameRow {
  attendee_id: string
  display_name: string
  qr_identifier: string
}

interface ScannerLabelRow {
  id: string
  label: string
}

/**
 * Loads read-only meal dashboard aggregates.
 * - Validations / scanner labels: Supabase (mobile scan history)
 * - Entitled counts: live RegFox attendee cache via getValidatableMeals (preferred)
 * - Falls back to Supabase meal_entitlements only when the cache is empty
 */
export async function loadMealDashboard(): Promise<MealDashboardResult> {
  const client = getSupabaseServiceClient()
  if (!client) {
    return {
      success: false,
      error:
        'Phone / cloud service is not configured. Open Settings to connect Supabase, then try again.',
    }
  }

  const conference = await resolveConferenceId(false)
  if (!conference) {
    return {
      success: false,
      error:
        'No active conference is linked to Supabase yet. Publish registrations to the phone service first.',
    }
  }

  const { data: validationData, error: validationError } = await client
    .from('meal_validations')
    .select('attendee_id, meal_key, meal_label, validated_at, scanner_session_id')
    .eq('conference_id', conference.id)

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

  const liveAttendees =
    isAttendeeCacheLoaded() && getAttendeeCache().length > 0 ? getAttendeeCache() : []

  let entitlementSource: 'regfox_cache' | 'supabase_fallback' = 'regfox_cache'
  let entitlements = buildEntitlementsFromAttendees(liveAttendees)
  const attendeeNamesById = buildAttendeeNameMap(liveAttendees)

  if (liveAttendees.length === 0) {
    entitlementSource = 'supabase_fallback'
    const { data: entitlementData, error: entitlementError } = await client
      .from('meal_entitlements')
      .select('attendee_id, meal_key')
      .eq('conference_id', conference.id)

    if (entitlementError) {
      return {
        success: false,
        error: `Unable to load meal entitlements: ${entitlementError.message}`,
      }
    }

    entitlements = ((entitlementData ?? []) as EntitlementRow[]).map((row) => ({
      attendeeId: row.attendee_id,
      mealKey: row.meal_key,
    }))
  }

  // Fill any missing display names from Supabase (e.g. scanned guests no longer in cache).
  {
    const { data: attendeeData, error: attendeeError } = await client
      .from('attendees')
      .select('attendee_id, display_name, qr_identifier')
      .eq('conference_id', conference.id)

    if (attendeeError) {
      return {
        success: false,
        error: `Unable to load attendee names: ${attendeeError.message}`,
      }
    }

    for (const row of (attendeeData ?? []) as AttendeeNameRow[]) {
      const name = row.display_name?.trim()
      if (!name) {
        continue
      }
      if (row.qr_identifier && !attendeeNamesById.has(row.qr_identifier)) {
        attendeeNamesById.set(row.qr_identifier, name)
      }
      if (row.attendee_id && !attendeeNamesById.has(row.attendee_id)) {
        attendeeNamesById.set(row.attendee_id, name)
      }
    }
  }

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

  const aggregated = aggregateMealDashboard({
    validations: validations.map((row) => ({
      attendeeId: row.attendee_id,
      mealKey: row.meal_key,
      mealLabel: row.meal_label,
      validatedAt: row.validated_at,
      scannerSessionId: row.scanner_session_id,
    })),
    entitlements,
    attendeeNamesById,
    scannerLabelsById,
  })

  const validatedMealKeysByAttendee = new Map<string, Set<string>>()
  for (const row of validations) {
    const attendeeId = row.attendee_id.trim()
    if (!attendeeId) {
      continue
    }
    const keys = validatedMealKeysByAttendee.get(attendeeId) ?? new Set<string>()
    keys.add(resolveCanonicalMealServiceId(row.meal_key))
    validatedMealKeysByAttendee.set(attendeeId, keys)
  }

  return {
    success: true,
    data: {
      conferenceId: conference.id,
      conferenceName: conference.name,
      summary: aggregated.summary,
      meals: aggregated.meals,
      recentScans: aggregated.recentScans,
      attendeeValidatedMealKeys: Object.fromEntries(
        [...validatedMealKeysByAttendee].map(([attendeeId, keys]) => [
          attendeeId,
          [...keys],
        ]),
      ),
      refreshedAt: new Date().toISOString(),
      entitlementSource,
    },
  }
}

/**
 * Loads a read-only per-meal attendee report for the active conference.
 * Scoped to the selected meal (canonical key + known aliases).
 */
export async function loadMealDashboardDetail(mealKey: string): Promise<MealDetailResult> {
  const selectedMealKey = mealKey?.trim()
  if (!selectedMealKey) {
    return { success: false, error: 'Select a meal to view its detail report.' }
  }

  const client = getSupabaseServiceClient()
  if (!client) {
    return {
      success: false,
      error:
        'Phone / cloud service is not configured. Open Settings to connect Supabase, then try again.',
    }
  }

  const conference = await resolveConferenceId(false)
  if (!conference) {
    return {
      success: false,
      error:
        'No active conference is linked to Supabase yet. Publish registrations to the phone service first.',
    }
  }

  const mealKeys = mealKeysMatchingCanonical(selectedMealKey)

  const { data: validationData, error: validationError } = await client
    .from('meal_validations')
    .select('attendee_id, meal_key, meal_label, validated_at, scanner_session_id')
    .eq('conference_id', conference.id)
    .in('meal_key', mealKeys)

  if (validationError) {
    return {
      success: false,
      error: `Unable to load meal validations: ${validationError.message}`,
    }
  }

  const validations = (validationData ?? []) as ValidationRow[]

  const liveAttendees =
    isAttendeeCacheLoaded() && getAttendeeCache().length > 0 ? getAttendeeCache() : []

  let entitlementSource: 'regfox_cache' | 'supabase_fallback' = 'regfox_cache'
  let entitlements = buildEntitlementsFromAttendees(liveAttendees)
  const attendeeNamesById = buildAttendeeNameMap(liveAttendees)

  if (liveAttendees.length === 0) {
    entitlementSource = 'supabase_fallback'
    const { data: entitlementData, error: entitlementError } = await client
      .from('meal_entitlements')
      .select('attendee_id, meal_key')
      .eq('conference_id', conference.id)
      .in('meal_key', mealKeys)

    if (entitlementError) {
      return {
        success: false,
        error: `Unable to load meal entitlements: ${entitlementError.message}`,
      }
    }

    entitlements = ((entitlementData ?? []) as EntitlementRow[]).map((row) => ({
      attendeeId: row.attendee_id,
      mealKey: row.meal_key,
    }))
  }

  // Narrow name lookups to IDs for this meal only (live cache entitlements include all meals).
  const selectedCanonical = resolveCanonicalMealServiceId(selectedMealKey)
  const idsNeedingNames = new Set<string>()
  for (const row of entitlements) {
    if (resolveCanonicalMealServiceId(row.mealKey) !== selectedCanonical) {
      continue
    }
    const id = row.attendeeId?.trim()
    if (id && !attendeeNamesById.has(id)) {
      idsNeedingNames.add(id)
    }
  }
  for (const row of validations) {
    const id = row.attendee_id?.trim()
    if (id && !attendeeNamesById.has(id)) {
      idsNeedingNames.add(id)
    }
  }

  if (idsNeedingNames.size > 0) {
    const idList = [...idsNeedingNames]
    const { data: byQr, error: byQrError } = await client
      .from('attendees')
      .select('attendee_id, display_name, qr_identifier')
      .eq('conference_id', conference.id)
      .in('qr_identifier', idList)

    if (byQrError) {
      return {
        success: false,
        error: `Unable to load attendee names: ${byQrError.message}`,
      }
    }

    const { data: byId, error: byIdError } = await client
      .from('attendees')
      .select('attendee_id, display_name, qr_identifier')
      .eq('conference_id', conference.id)
      .in('attendee_id', idList)

    if (byIdError) {
      return {
        success: false,
        error: `Unable to load attendee names: ${byIdError.message}`,
      }
    }

    for (const row of [...((byQr ?? []) as AttendeeNameRow[]), ...((byId ?? []) as AttendeeNameRow[])]) {
      const name = row.display_name?.trim()
      if (!name) {
        continue
      }
      if (row.qr_identifier && !attendeeNamesById.has(row.qr_identifier)) {
        attendeeNamesById.set(row.qr_identifier, name)
      }
      if (row.attendee_id && !attendeeNamesById.has(row.attendee_id)) {
        attendeeNamesById.set(row.attendee_id, name)
      }
    }
  }

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

  const detail = buildMealDetailReport({
    mealKey: selectedMealKey,
    entitlements,
    validations: validations.map((row) => ({
      attendeeId: row.attendee_id,
      mealKey: row.meal_key,
      mealLabel: row.meal_label,
      validatedAt: row.validated_at,
      scannerSessionId: row.scanner_session_id,
    })),
    attendeeNamesById,
    scannerLabelsById,
    entitlementSource,
    refreshedAt: new Date().toISOString(),
  })

  return { success: true, data: detail }
}
