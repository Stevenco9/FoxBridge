import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Registered Desktop Sync entity types.
 * Add new literals here when introducing handlers (notes, badge history, …).
 */
export type SyncEntityType = 'attendee_snapshot' | 'meal_validations' | 'check_in_state'

export interface SyncContext {
  conferenceId: string
  client: SupabaseClient
  /** Active FoxBridge Event id when known — used to scope sync cursors. */
  foxbridgeEventId?: string | null
}

export interface SyncEntityResult {
  entityType: SyncEntityType
  status: 'synced' | 'skipped' | 'failed'
  /** Cloud rows examined in this run. */
  pulled: number
  /** Rows newly inserted into SQLite. */
  inserted: number
  /** Rows skipped because of local uniqueness / already present. */
  skippedExisting: number
  error?: string
}

export interface SyncRunResult {
  /**
   * `skipped` — Cloud not configured / not connected / no conference (offline-safe no-op).
   * `synced` — at least one entity handled without hard failure of the run.
   * `failed` — could not run (unexpected); never thrown to callers of sync().
   */
  status: 'synced' | 'skipped' | 'failed'
  reason?: string
  entities: SyncEntityResult[]
}

/**
 * Pluggable sync handler. Each entity owns its Cloud query, cursor, and
 * SQLite apply policy (no generic conflict engine).
 */
export interface SyncEntityHandler {
  readonly entityType: SyncEntityType
  sync(context: SyncContext): Promise<SyncEntityResult>
}
