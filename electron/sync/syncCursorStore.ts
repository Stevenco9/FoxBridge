import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { SyncEntityType } from './syncTypes'

const STORE_FILENAME = 'desktop-sync-cursors.json'

export interface SyncEntityCursor {
  /** ISO timestamp of last successfully processed cloud `validated_at` (or equivalent). */
  lastTimestamp: string | null
  /** Cloud row id at that timestamp for stable incremental paging. */
  lastId: string | null
}

interface SyncCursorFile {
  version: 1 | 2
  /** Legacy v1: conferenceId → entityType → cursor */
  conferences: Record<string, Partial<Record<SyncEntityType, SyncEntityCursor>>>
  /**
   * v2: FoxBridge Event id → Cloud conference id → entity cursors.
   * Associates Desktop Sync state with a FoxBridge Event.
   */
  events: Record<
    string,
    {
      conferences: Record<string, Partial<Record<SyncEntityType, SyncEntityCursor>>>
    }
  >
}

const EMPTY_CURSOR: SyncEntityCursor = {
  lastTimestamp: null,
  lastId: null,
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), STORE_FILENAME)
}

async function readFile(): Promise<SyncCursorFile> {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<SyncCursorFile>
    return {
      version: parsed.version === 2 ? 2 : 1,
      conferences:
        parsed.conferences && typeof parsed.conferences === 'object'
          ? parsed.conferences
          : {},
      events:
        parsed.events && typeof parsed.events === 'object' ? parsed.events : {},
    }
  } catch {
    return { version: 2, conferences: {}, events: {} }
  }
}

async function writeFile(data: SyncCursorFile): Promise<void> {
  await fs.writeFile(
    getStorePath(),
    `${JSON.stringify({ ...data, version: 2 }, null, 2)}\n`,
    'utf8',
  )
}

function normalizeCursor(cursor: SyncEntityCursor | undefined): SyncEntityCursor {
  if (!cursor) {
    return { ...EMPTY_CURSOR }
  }

  return {
    lastTimestamp:
      typeof cursor.lastTimestamp === 'string' ? cursor.lastTimestamp : null,
    lastId: typeof cursor.lastId === 'string' ? cursor.lastId : null,
  }
}

/**
 * Reads an entity sync cursor.
 * Prefer FoxBridge Event association; fall back to legacy conference-only keys.
 */
export async function getSyncEntityCursor(
  conferenceId: string,
  entityType: SyncEntityType,
  foxbridgeEventId?: string | null,
): Promise<SyncEntityCursor> {
  const confId = conferenceId.trim()
  if (!confId) {
    return { ...EMPTY_CURSOR }
  }

  const file = await readFile()
  const eventId = foxbridgeEventId?.trim()

  if (eventId) {
    const fromEvent = file.events[eventId]?.conferences?.[confId]?.[entityType]
    if (fromEvent) {
      return normalizeCursor(fromEvent)
    }
  }

  return normalizeCursor(file.conferences[confId]?.[entityType])
}

/**
 * Writes an entity sync cursor under the FoxBridge Event when provided,
 * and mirrors the legacy conference key for compatibility.
 */
export async function setSyncEntityCursor(
  conferenceId: string,
  entityType: SyncEntityType,
  cursor: SyncEntityCursor,
  foxbridgeEventId?: string | null,
): Promise<void> {
  const confId = conferenceId.trim()
  if (!confId) {
    return
  }

  const file = await readFile()
  const nextCursor = {
    lastTimestamp: cursor.lastTimestamp,
    lastId: cursor.lastId,
  }

  const legacy = file.conferences[confId] ?? {}
  file.conferences[confId] = {
    ...legacy,
    [entityType]: nextCursor,
  }

  const eventId = foxbridgeEventId?.trim()
  if (eventId) {
    const eventBucket = file.events[eventId] ?? { conferences: {} }
    const confBucket = eventBucket.conferences[confId] ?? {}
    eventBucket.conferences[confId] = {
      ...confBucket,
      [entityType]: nextCursor,
    }
    file.events[eventId] = eventBucket
  }

  await writeFile(file)
}
