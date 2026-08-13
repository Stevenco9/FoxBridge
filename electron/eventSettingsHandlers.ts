import { ipcMain } from 'electron'
import type {
  EventSettingsEntry,
  EventSettingsPatch,
} from '../src/shared/models/EventSettings'
import { createDefaultEventSettingsEntry } from '../src/shared/models/EventSettings'
import {
  getEventSettings,
  patchEventSettings,
} from './settings/eventSettingsStore'
import { assertEventAccessUnlocked } from './session/eventAccessSession'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizePatch(raw: unknown): EventSettingsPatch {
  if (!isPlainObject(raw)) {
    return {}
  }

  const patch: EventSettingsPatch = {}

  if (isPlainObject(raw.attendeeDisplay)) {
    const attendeeDisplay: EventSettingsPatch['attendeeDisplay'] = {}
    if ('fieldKeys' in raw.attendeeDisplay) {
      attendeeDisplay.fieldKeys = Array.isArray(raw.attendeeDisplay.fieldKeys)
        ? (raw.attendeeDisplay.fieldKeys as string[])
        : []
    }
    patch.attendeeDisplay = attendeeDisplay
  }

  return patch
}

/**
 * Generic per-event settings IPC (Sprint 20.2).
 * Get/patch the whole EventSettingsEntry so future sections
 * (badgeLayout, meals, …) reuse the same channels.
 */
export function registerEventSettingsHandlers(): void {
  ipcMain.removeHandler('eventSettings:get')
  ipcMain.handle(
    'eventSettings:get',
    async (_event, eventId: string): Promise<EventSettingsEntry> => {
      assertEventAccessUnlocked()
      if (typeof eventId !== 'string' || !eventId.trim()) {
        return createDefaultEventSettingsEntry()
      }

      return getEventSettings(eventId)
    },
  )

  ipcMain.removeHandler('eventSettings:patch')
  ipcMain.handle(
    'eventSettings:patch',
    async (
      _event,
      eventId: string,
      patch: unknown,
    ): Promise<EventSettingsEntry> => {
      assertEventAccessUnlocked()
      if (typeof eventId !== 'string' || !eventId.trim()) {
        return createDefaultEventSettingsEntry()
      }

      return patchEventSettings(eventId, sanitizePatch(patch))
    },
  )
}
