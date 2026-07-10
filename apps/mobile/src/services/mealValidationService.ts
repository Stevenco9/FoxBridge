import { getSupabaseClient } from '../lib/supabaseClient'
import {
  MealValidationError,
  type StoredMealValidation,
  type ValidateMealRequest,
  type ValidateMealResult,
} from '../models/mealValidation'

interface MealValidationRow {
  meal_key: string
  meal_label: string
  validated_at: string
}

interface ValidateMealRpcRow {
  status: string
  validated_at: string
  meal_key: string
  meal_label: string
}

function mapValidationRow(row: MealValidationRow): StoredMealValidation {
  return {
    mealKey: row.meal_key,
    mealLabel: row.meal_label,
    validatedAt: row.validated_at,
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

function sanitizeErrorText(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/g, '[redacted]')
}

function postgrestHttpStatus(code: string | null | undefined): number | null {
  if (code === 'PGRST301') {
    return 401
  }
  if (code === '42501') {
    return 403
  }
  if (code === '22P02' || code === '42702') {
    return 400
  }
  return null
}

function readRpcError(error: unknown): {
  message: string
  code: string | null
  details: string | null
} | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const candidate = error as { message?: string; code?: string; details?: string }
  if (typeof candidate.message !== 'string') {
    return null
  }

  return {
    message: candidate.message,
    code: candidate.code ?? null,
    details: candidate.details ?? null,
  }
}

function logValidationFailure(
  step: 'rpc' | 'empty-result',
  error: unknown,
): void {
  const rpcError = readRpcError(error)
  if (rpcError) {
    console.error(
      '[meal-validation]',
      JSON.stringify({
        step,
        httpStatus: postgrestHttpStatus(rpcError.code),
        code: rpcError.code,
        message: sanitizeErrorText(rpcError.message),
        details: sanitizeErrorText(rpcError.details),
      }),
    )
    return
  }

  console.error('[meal-validation]', JSON.stringify({ step, message: 'Unknown validation failure' }))
}

function wrapError(error: unknown): MealValidationError {
  if (error instanceof MealValidationError) {
    return error
  }

  if (isNetworkFailure(error)) {
    return new MealValidationError('Network unavailable. Check your connection and try again.')
  }

  const rpcError = readRpcError(error)
  if (rpcError) {
    if (rpcError.message.includes('Meal not entitled')) {
      return new MealValidationError('This meal is not on the attendee record. Refresh and try again.')
    }

    return new MealValidationError('Unable to validate this meal. Try again.')
  }

  if (error instanceof Error) {
    if (error.message.includes('Meal not entitled')) {
      return new MealValidationError('This meal is not on the attendee record. Refresh and try again.')
    }

    return new MealValidationError('Unable to validate this meal. Try again.')
  }

  return new MealValidationError('Unable to validate this meal. Try again.')
}

export async function getMealValidationsForAttendee(
  conferenceId: string,
  attendeeId: string,
): Promise<StoredMealValidation[]> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new MealValidationError('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('meal_validations')
    .select('meal_key, meal_label, validated_at')
    .eq('conference_id', conferenceId)
    .eq('attendee_id', attendeeId)
    .order('validated_at')

  if (error) {
    throw wrapError(error)
  }

  return ((data ?? []) as MealValidationRow[]).map(mapValidationRow)
}

export async function validateMeal(request: ValidateMealRequest): Promise<ValidateMealResult> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new MealValidationError('Supabase is not configured.')
  }

  const { data, error } = await supabase.rpc('validate_meal', {
    p_conference_id: request.conferenceId,
    p_attendee_id: request.attendeeId,
    p_meal_key: request.mealKey,
    p_meal_label: request.mealLabel,
    p_scanner_session_id: request.scannerSessionId,
  })

  if (error) {
    logValidationFailure('rpc', error)
    throw wrapError(error)
  }

  const row = (Array.isArray(data) ? data[0] : data) as ValidateMealRpcRow | undefined
  if (!row) {
    logValidationFailure('empty-result', { message: 'validate_meal returned no rows' })
    throw new MealValidationError('Unable to validate this meal. Try again.')
  }

  const status = row.status === 'created' ? 'created' : 'already_exists'

  return {
    status,
    mealKey: row.meal_key,
    mealLabel: row.meal_label,
    validatedAt: row.validated_at,
  }
}
