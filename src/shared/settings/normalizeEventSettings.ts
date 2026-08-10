import {
  createDefaultAttendeeDisplaySettings,
  createDefaultEventSettingsEntry,
  createEmptyEventSettingsFile,
  EVENT_SETTINGS_FILE_VERSION,
  type AttendeeDisplaySettings,
  type EventSettingsEntry,
  type EventSettingsFile,
  type EventSettingsPatch,
} from '../models/EventSettings'

/**
 * Stable field keys only: trim, drop empties, preserve first-seen order.
 */
export function normalizeFieldKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) {
    return []
  }

  const seen = new Set<string>()
  const result: string[] = []

  for (const item of keys) {
    if (typeof item !== 'string') {
      continue
    }

    const key = item.trim()
    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(key)
  }

  return result
}

export function normalizeAttendeeDisplaySettings(
  raw: unknown,
): AttendeeDisplaySettings {
  const defaults = createDefaultAttendeeDisplaySettings()
  if (!raw || typeof raw !== 'object') {
    return defaults
  }

  const record = raw as Record<string, unknown>
  return {
    fieldKeys: normalizeFieldKeys(record.fieldKeys),
  }
}

export function normalizeEventSettingsEntry(raw: unknown): EventSettingsEntry {
  const defaults = createDefaultEventSettingsEntry()
  if (!raw || typeof raw !== 'object') {
    return defaults
  }

  const record = raw as Record<string, unknown>
  return {
    attendeeDisplay: normalizeAttendeeDisplaySettings(record.attendeeDisplay),
  }
}

export function applyEventSettingsPatch(
  current: EventSettingsEntry,
  patch: EventSettingsPatch,
): EventSettingsEntry {
  const next = normalizeEventSettingsEntry(current)

  if (patch.attendeeDisplay) {
    next.attendeeDisplay = normalizeAttendeeDisplaySettings({
      ...next.attendeeDisplay,
      ...patch.attendeeDisplay,
    })
  }

  return next
}

export function normalizeEventSettingsFile(raw: unknown): EventSettingsFile {
  const empty = createEmptyEventSettingsFile()
  if (!raw || typeof raw !== 'object') {
    return empty
  }

  const record = raw as Record<string, unknown>
  const version =
    typeof record.version === 'number' && Number.isFinite(record.version)
      ? Math.floor(record.version)
      : EVENT_SETTINGS_FILE_VERSION

  const eventsRaw =
    record.events && typeof record.events === 'object'
      ? (record.events as Record<string, unknown>)
      : {}

  const events: Record<string, EventSettingsEntry> = {}
  for (const [eventId, entry] of Object.entries(eventsRaw)) {
    const trimmedId = eventId.trim()
    if (!trimmedId) {
      continue
    }
    events[trimmedId] = normalizeEventSettingsEntry(entry)
  }

  return {
    version: version > 0 ? version : EVENT_SETTINGS_FILE_VERSION,
    events,
  }
}
