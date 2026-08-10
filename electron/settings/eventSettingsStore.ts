import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  createDefaultEventSettingsEntry,
  createEmptyEventSettingsFile,
  type EventSettingsEntry,
  type EventSettingsFile,
  type EventSettingsPatch,
} from '../../src/shared/models/EventSettings'
import {
  applyEventSettingsPatch,
  normalizeEventSettingsEntry,
  normalizeEventSettingsFile,
} from '../../src/shared/settings/normalizeEventSettings'

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
 * Returns preferences for one RegFox event.
 * Missing events yield defaults without writing the file.
 */
export async function getEventSettings(
  eventId: string,
): Promise<EventSettingsEntry> {
  const id = normalizeEventId(eventId)
  if (!id) {
    return createDefaultEventSettingsEntry()
  }

  const file = await readFile()
  return normalizeEventSettingsEntry(file.events[id])
}

/**
 * Merges a patch into one event's settings and persists the file.
 * Returns the normalized entry after write.
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
  const current = normalizeEventSettingsEntry(file.events[id])
  const next = applyEventSettingsPatch(current, patch ?? {})

  file.events[id] = next
  await writeFile(file)
  return next
}

/** Absolute path to the on-disk store (for diagnostics / tests). */
export function getEventSettingsFilePath(): string {
  return getStorePath()
}
