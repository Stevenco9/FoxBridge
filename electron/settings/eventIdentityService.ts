import type { Event } from '../../src/shared/models/Event'
import {
  ensureEvent,
  getEventById,
  rekeyLocalEventStoreAttendees,
} from '../db/eventRepository'
import { migrateEventSettingsAlias } from './eventSettingsStore'
import { patchPublicSettings, readPublicSettings } from './settingsStore'

export interface ActivateRegFoxEventInput {
  platformEventId: string
  name?: string | null
  markSynced?: boolean
  syncedAt?: string | null
}

/**
 * Ensures a FoxBridge Event for a RegFox page id, associates local stores,
 * and sets `activeEventId` while leaving `regfoxEventId` as the RegFox key.
 */
export async function activateRegFoxEvent(
  input: ActivateRegFoxEventInput,
): Promise<Event> {
  const platformEventId = input.platformEventId.trim()
  if (!platformEventId) {
    throw new Error('platformEventId is required.')
  }

  const settings = await readPublicSettings()
  const name = input.name?.trim() || settings.conferenceName

  const event = ensureEvent({
    registrationPlatform: 'regfox',
    platformEventId,
    name,
    markSynced: input.markSynced === true,
    syncedAt: input.syncedAt,
  })

  rekeyLocalEventStoreAttendees(platformEventId, event.id, 'regfox')
  await migrateEventSettingsAlias(platformEventId, event.id)

  await patchPublicSettings({
    regfoxEventId: platformEventId,
    activeEventId: event.id,
    conferenceName: settings.conferenceName ?? event.name,
  })

  return event
}

/**
 * Boot migration: if RegFox is configured but no active FoxBridge Event is set,
 * create/link the Event and rekey associated local data.
 */
export async function ensureActiveEventIdentityFromSettings(): Promise<Event | null> {
  const settings = await readPublicSettings()
  const platformEventId = settings.regfoxEventId?.trim()
  if (!platformEventId) {
    return null
  }

  if (settings.activeEventId?.trim()) {
    const existing = getEventById(settings.activeEventId)
    if (existing) {
      // Keep associations warm if store still has legacy keys.
      rekeyLocalEventStoreAttendees(platformEventId, existing.id, 'regfox')
      await migrateEventSettingsAlias(platformEventId, existing.id)
      return existing
    }
  }

  return activateRegFoxEvent({
    platformEventId,
    name: settings.conferenceName,
    markSynced: Boolean(settings.lastAttendeeSyncAt),
    syncedAt: settings.lastAttendeeSyncAt,
  })
}

/**
 * Prefer FoxBridge Event id for Local Event Store keys; fall back to RegFox page id.
 * While an EventAccessSession is unlocked, callers should prefer session.eventId instead.
 */
export async function resolveLocalEventStoreKey(): Promise<string | null> {
  const settings = await readPublicSettings()
  return settings.activeEventId?.trim() || settings.regfoxEventId?.trim() || null
}

/**
 * Local FoxBridge Event for a Cloud conference (Linked join / Cloud-backed desks).
 * Uses registration_platform `foxbridge-cloud` + conference UUID so RegFox page ids
 * never satisfy Principal ownership from a join code alone.
 */
export async function activateCloudConferenceEvent(input: {
  conferenceId: string
  name?: string | null
}): Promise<Event> {
  const conferenceId = input.conferenceId.trim()
  if (!conferenceId) {
    throw new Error('conferenceId is required.')
  }

  const event = ensureEvent({
    registrationPlatform: 'foxbridge-cloud',
    platformEventId: conferenceId,
    name: input.name?.trim() || `FoxBridge Event ${conferenceId.slice(0, 8)}`,
  })

  await patchPublicSettings({
    activeEventId: event.id,
    conferenceId,
    conferenceName: input.name?.trim() || event.name,
  })

  return event
}
