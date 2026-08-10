/**
 * Per-event organizer preferences stored in Electron userData
 * (`event-settings.json`), keyed by RegFox event id.
 *
 * Global / install settings stay in AppSettingsPublic. Operational history
 * stays in SQLite. This file is only event-scoped UI and workflow config.
 */

export const EVENT_SETTINGS_FILE_VERSION = 1

/**
 * Attendee details panel preferences for one event.
 * `fieldKeys` are stable catalog keys from discoverAvailableAttendeeFields
 * (not display labels).
 */
export interface AttendeeDisplaySettings {
  fieldKeys: string[]
}

/**
 * All known per-event preference sections.
 * Add optional sections here as features land (badgeLayout, meals, …).
 */
export interface EventSettingsEntry {
  attendeeDisplay: AttendeeDisplaySettings
}

/**
 * On-disk root document for `event-settings.json`.
 */
export interface EventSettingsFile {
  version: number
  events: Record<string, EventSettingsEntry>
}

/**
 * Partial update for one event. Omitted sections are left unchanged.
 * Nested objects are shallow-merged into the existing section.
 */
export interface EventSettingsPatch {
  attendeeDisplay?: Partial<AttendeeDisplaySettings>
}

export function createDefaultAttendeeDisplaySettings(): AttendeeDisplaySettings {
  return {
    fieldKeys: [],
  }
}

export function createDefaultEventSettingsEntry(): EventSettingsEntry {
  return {
    attendeeDisplay: createDefaultAttendeeDisplaySettings(),
  }
}

export function createEmptyEventSettingsFile(): EventSettingsFile {
  return {
    version: EVENT_SETTINGS_FILE_VERSION,
    events: {},
  }
}
