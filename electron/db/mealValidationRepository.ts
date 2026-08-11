import { randomUUID } from 'node:crypto'
import type {
  StoredMealValidation,
  ValidateMealRequest,
  ValidateMealResult,
} from '../../src/shared/models/MealValidation'
import { getDatabase } from './database'

interface MealValidationRow {
  meal_key: string
  meal_label: string
  validated_at: string
  validated_by: string | null
}

function mapRow(row: MealValidationRow): StoredMealValidation {
  return {
    mealKey: row.meal_key,
    mealLabel: row.meal_label,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by,
  }
}

export function getMealValidationsForAttendee(attendeeId: string): StoredMealValidation[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT meal_key, meal_label, validated_at, validated_by
       FROM meal_validations
       WHERE attendee_id = ?
       ORDER BY validated_at ASC`,
    )
    .all(attendeeId) as MealValidationRow[]

  return rows.map(mapRow)
}

export function validateMeal(request: ValidateMealRequest): ValidateMealResult {
  const db = getDatabase()
  const existing = db
    .prepare(
      `SELECT meal_key, meal_label, validated_at, validated_by
       FROM meal_validations
       WHERE attendee_id = ? AND meal_key = ?`,
    )
    .get(request.attendeeId, request.mealKey) as MealValidationRow | undefined

  if (existing) {
    return {
      status: 'already_exists',
      validation: mapRow(existing),
    }
  }

  const validatedAt = new Date().toISOString()
  const id = randomUUID()

  try {
    db.prepare(
      `INSERT INTO meal_validations (
        id, attendee_id, meal_key, meal_label, validated_at, validated_by, source
      ) VALUES (?, ?, ?, ?, ?, ?, 'desktop')`,
    ).run(
      id,
      request.attendeeId,
      request.mealKey,
      request.mealLabel,
      validatedAt,
      request.validatedBy ?? null,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('UNIQUE constraint failed')) {
      const duplicate = db
        .prepare(
          `SELECT meal_key, meal_label, validated_at, validated_by
           FROM meal_validations
           WHERE attendee_id = ? AND meal_key = ?`,
        )
        .get(request.attendeeId, request.mealKey) as MealValidationRow | undefined

      if (duplicate) {
        return {
          status: 'already_exists',
          validation: mapRow(duplicate),
        }
      }
    }

    throw error
  }

  return {
    status: 'created',
    validation: {
      mealKey: request.mealKey,
      mealLabel: request.mealLabel,
      validatedAt,
      validatedBy: request.validatedBy ?? null,
    },
  }
}

export interface ImportSyncedMealValidationInput {
  /** Prefer Cloud row UUID so re-pulls are idempotent by primary key. */
  id: string
  attendeeId: string
  mealKey: string
  mealLabel: string
  /** Preserve Cloud timestamp — do not rewrite to "now". */
  validatedAt: string
  validatedBy?: string | null
  /** Cloud source when present; defaults to sync. */
  source?: string
}

/**
 * Inserts a Cloud meal validation into local SQLite without overwriting locals.
 * Policy: first write wins on UNIQUE(attendee_id, meal_key) and on primary key.
 * Does not change `validateMeal()` desktop semantics.
 */
export function importSyncedMealValidation(
  input: ImportSyncedMealValidationInput,
): 'inserted' | 'already_exists' {
  const db = getDatabase()
  const id = input.id.trim()
  const attendeeId = input.attendeeId.trim()
  const mealKey = input.mealKey.trim()
  const mealLabel = input.mealLabel.trim()
  const validatedAt = input.validatedAt.trim()
  const source = (input.source?.trim() || 'sync').slice(0, 64)

  if (!id || !attendeeId || !mealKey || !mealLabel || !validatedAt) {
    return 'already_exists'
  }

  const existingByPair = db
    .prepare(
      `SELECT meal_key FROM meal_validations
       WHERE attendee_id = ? AND meal_key = ?`,
    )
    .get(attendeeId, mealKey) as { meal_key: string } | undefined

  if (existingByPair) {
    return 'already_exists'
  }

  const existingById = db
    .prepare(`SELECT id FROM meal_validations WHERE id = ?`)
    .get(id) as { id: string } | undefined

  if (existingById) {
    return 'already_exists'
  }

  try {
    db.prepare(
      `INSERT INTO meal_validations (
        id, attendee_id, meal_key, meal_label, validated_at, validated_by, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      attendeeId,
      mealKey,
      mealLabel,
      validatedAt,
      input.validatedBy ?? null,
      source,
    )
    return 'inserted'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('UNIQUE constraint failed')) {
      return 'already_exists'
    }
    throw error
  }
}
