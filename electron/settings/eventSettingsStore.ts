import type {
  EventSettingsEntry,
  EventSettingsFile,
  EventSettingsPatch,
} from '../../src/shared/models/EventSettings'
import {
  createDefaultEventSettingsEntry,
  createEmptyEventSettingsFile,
} from '../../src/shared/models/EventSettings'
import {
  applyEventSettingsPatch,
  normalizeEventSettingsEntry,
  normalizeEventSettingsFile,
} from '../../src/shared/settings/normalizeEventSettings'
import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { findEventByPlatform, getEventById } from '../db/eventRepository'

const STORE_FILENAME = 'event-settings.json'

function getStorePath(): string {
  return path.join(app.getPath('userData'), STORE_FILENAME)
}

async function readFile(): Promise<EventSettingsFile> {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf8')
    return normalizeEventSettingsFile(JSON.parse(raw) as unknown)
  } catch {
    return createEmptyEventSettingsFile()
  }
}

async function writeFile(data: EventSettingsFile): Promise<void> {
  await fs.writeFile(getStorePath(), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function normalizeEventId(eventId: string | null | undefined): string | null {
  const trimmed = eventId?.trim()
  return trimmed || null
}

/**
 * Resolves storage keys for an event id that may be a FoxBridge Event id
 * or a legacy registration-platform event id (e.g. RegFox page id).
 */
function resolveSettingsKeys(eventKey: string): string[] {
  const keys = [eventKey]
  const byId = getEventById(eventKey)
  if (byId) {
    keys.push(byId.platformEventId)
    return [...new Set(keys.map((key) => key.trim()).filter(Boolean))]
  }

  // Look up as RegFox platform id (most common legacy key).
  const byRegFox = findEventByPlatform('regfox', eventKey)
  if (byRegFox) {
    keys.unshift(byRegFox.id)
  }

  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))]
}

function readEntryForKeys(
  file: EventSettingsFile,
  keys: string[],
): { entry: EventSettingsEntry; primaryKey: string } {
  for (const key of keys) {
    if (file.events[key]) {
      return {
        entry: normalizeEventSettingsEntry(file.events[key]),
        primaryKey: keys[0] ?? key,
      }
    }
  }

  return {
    entry: createDefaultEventSettingsEntry(),
    primaryKey: keys[0] ?? '',
  }
}

/**
 * Returns preferences for one event (FoxBridge Event id preferred; platform id still works).
 */
export async function getEventSettings(eventId: string): Promise<EventSettingsEntry> {
  const id = normalizeEventId(eventId)
  if (!id) {
    return createDefaultEventSettingsEntry()
  }

  const file = await readFile()
  const keys = resolveSettingsKeys(id)
  return readEntryForKeys(file, keys).entry
}

/**
 * Merges a patch and persists under the FoxBridge Event id when known,
 * while mirroring the legacy platform-keyed entry for RegFox UI compatibility.
 */
export async function patchEventSettings(
  eventId: string,
  patch: EventSettingsPatch,
): Promise<EventSettingsEntry> {
  const id = normalizeEventId(eventId)
  if (!id) {
    return createDefaultEventSettingsEntry()
  }

  const file = await readFile()
  const keys = resolveSettingsKeys(id)
  const { entry } = readEntryForKeys(file, keys)
  const next = applyEventSettingsPatch(entry, patch ?? {})

  const foxbridgeEvent =
    getEventById(id) ?? findEventByPlatform('regfox', id)
  const primaryKey = foxbridgeEvent?.id ?? id
  const aliasKey = foxbridgeEvent?.platformEventId

  file.events[primaryKey] = next
  if (aliasKey && aliasKey !== primaryKey) {
    file.events[aliasKey] = next
  }

  await writeFile(file)
  return next
}

/**
 * Copies Event Settings from a legacy platform event key onto the FoxBridge Event id.
 */
export async function migrateEventSettingsAlias(
  platformEventId: string,
  foxbridgeEventId: string,
): Promise<void> {
  const fromId = platformEventId.trim()
  const toId = foxbridgeEventId.trim()
  if (!fromId || !toId || fromId === toId) {
    return
  }

  const file = await readFile()
  const legacy = file.events[fromId]
  if (!legacy) {
    return
  }

  if (!file.events[toId]) {
    file.events[toId] = normalizeEventSettingsEntry(legacy)
    await writeFile(file)
  }
}

/** Absolute path to the on-disk store (for diagnostics / tests). */
export function getEventSettingsFilePath(): string {
  return getStorePath()
}

export { createEmptyEventSettingsFile }
