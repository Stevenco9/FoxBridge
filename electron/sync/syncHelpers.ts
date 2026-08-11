/**
 * Pure helpers for Desktop Sync meal-validation pull (testable without Electron).
 */

export interface AttendeeIdMappingInput {
  id: string
  qrIdentifier: string
}

/**
 * Maps a Cloud meal_validations.attendee_id onto the Desktop SQLite attendee_id
 * used by local meal UI (prefer stable Attendee.id when the cloud key is a QR).
 */
export function resolveLocalAttendeeIdForSync(
  cloudAttendeeId: string,
  attendees: readonly AttendeeIdMappingInput[],
): string {
  const cloudId = cloudAttendeeId.trim()
  if (!cloudId) {
    return cloudAttendeeId
  }

  for (const attendee of attendees) {
    if (attendee.id.trim() === cloudId) {
      return attendee.id.trim()
    }
  }

  for (const attendee of attendees) {
    if (attendee.qrIdentifier.trim() === cloudId && attendee.id.trim()) {
      return attendee.id.trim()
    }
  }

  return cloudId
}

export interface IncrementalCloudRow {
  id: string
  validatedAt: string
}

/**
 * True when a cloud row is strictly after the stored incremental cursor.
 */
export function isRowAfterSyncCursor(
  row: IncrementalCloudRow,
  cursor: { lastTimestamp: string | null; lastId: string | null },
): boolean {
  if (!cursor.lastTimestamp) {
    return true
  }

  if (row.validatedAt > cursor.lastTimestamp) {
    return true
  }

  if (row.validatedAt < cursor.lastTimestamp) {
    return false
  }

  if (!cursor.lastId) {
    return false
  }

  return row.id > cursor.lastId
}

/**
 * Advances cursor to the latest row in a batch (by timestamp, then id).
 */
export function advanceSyncCursor(
  current: { lastTimestamp: string | null; lastId: string | null },
  rows: readonly IncrementalCloudRow[],
): { lastTimestamp: string | null; lastId: string | null } {
  let next = { ...current }

  for (const row of rows) {
    if (!next.lastTimestamp || row.validatedAt > next.lastTimestamp) {
      next = { lastTimestamp: row.validatedAt, lastId: row.id }
      continue
    }

    if (
      row.validatedAt === next.lastTimestamp &&
      (!next.lastId || row.id > next.lastId)
    ) {
      next = { lastTimestamp: row.validatedAt, lastId: row.id }
    }
  }

  return next
}
