import { ipcMain } from 'electron'
import { checkInAttendee } from './regfox/checkInAttendee'
import { createRegFoxServiceFromSettings } from './regfox/regfoxConfig'
import {
  ensureAttendeeCacheForEvent,
  clearAttendeeCache,
  getAttendeeCache,
  getAttendeeCacheEventId,
  isAttendeeCacheLoaded,
} from './scannerServer/attendeeCache'
import {
  assertEventAccessUnlocked,
  getEventAccessSession,
} from './session/eventAccessSession'
import { resolveAuthorizedEventId } from '../src/shared/attendees/eventAttendeeIsolation'
import {
  connectRegFox,
  loadRegFoxAttendees,
  updateRegistrations,
} from './settings/settingsService'
import { readDeskCredentialSync } from './cloud/deskCredentialStore'

function attendeesForAuthorizedEvent(authorizedEventId: string) {
  if (getAttendeeCacheEventId() !== authorizedEventId) {
    return []
  }
  return getAttendeeCache().filter(
    (attendee) => !attendee.eventId?.trim() || attendee.eventId.trim() === authorizedEventId,
  )
}

export function registerRegFoxHandlers(): void {
  ipcMain.removeHandler('regfox:getAttendees')
  ipcMain.handle('regfox:getAttendees', async () => {
    assertEventAccessUnlocked()

    const session = getEventAccessSession()
    const authorizedEventId = resolveAuthorizedEventId({
      sessionEventId: session?.eventId,
    })
    if (!authorizedEventId) {
      return []
    }

    // EventAccessSession is the only authority — never serve another event's cache.
    if (!isAttendeeCacheLoaded() || getAttendeeCacheEventId() !== authorizedEventId) {
      ensureAttendeeCacheForEvent(authorizedEventId)
    }

    const local = attendeesForAuthorizedEvent(authorizedEventId)
    if (local.length > 0) {
      return local
    }

    // Empty for this event — Cloud desk pull only when role-gated allow
    // (Linked / Cloud-only legacy). Principal never Cloud-replaces RegFox data.
    const desk = readDeskCredentialSync()
    if (desk) {
      const { mayReplaceLocalAttendeesFromCloudSnapshot } = await import(
        './cloud/attendeeSnapshotAuthority'
      )
      if (await mayReplaceLocalAttendeesFromCloudSnapshot()) {
        const { hydrateAttendeesFromCloudForSession } = await import(
          './cloud/hydrateAttendeesFromCloud'
        )
        const hydrate = await hydrateAttendeesFromCloudForSession()
        if (hydrate.success) {
          return attendeesForAuthorizedEvent(authorizedEventId)
        }
        if (desk.role === 'linked') {
          // Fail-closed: never RegFox and never another local event.
          clearAttendeeCache()
          ensureAttendeeCacheForEvent(authorizedEventId)
          return attendeesForAuthorizedEvent(authorizedEventId)
        }
      }
    }

    // Principal / RegFox-authoritative — download from RegFox when configured.
    // Do not fall back to Cloud attendee projection.
    const result = await loadRegFoxAttendees()
    if (!result.success || getAttendeeCacheEventId() !== authorizedEventId) {
      ensureAttendeeCacheForEvent(authorizedEventId)
      return []
    }

    return attendeesForAuthorizedEvent(authorizedEventId)
  })

  ipcMain.removeHandler('regfox:checkInAttendee')
  ipcMain.handle('regfox:checkInAttendee', async (_event, attendeeId: string) => {
    assertEventAccessUnlocked()
    return checkInAttendee(attendeeId)
  })

  ipcMain.removeHandler('regfox:connect')
  ipcMain.handle(
    'regfox:connect',
    async (_event, payload: { apiKey: string; eventId: string }) =>
      connectRegFox(payload.apiKey, payload.eventId),
  )

  ipcMain.removeHandler('regfox:updateRegistrations')
  ipcMain.handle('regfox:updateRegistrations', async () => {
    assertEventAccessUnlocked()
    return updateRegistrations()
  })
}

export async function testRegFoxConnection(
  apiKey: string,
  eventId: string,
): Promise<{ success: boolean; message: string | null }> {
  const service = await createRegFoxServiceFromSettings()
  if (!service) {
    const { RegFoxService } = await import('../src/integrations/regfox/RegFoxService')
    const testService = new RegFoxService({ apiKey, eventId })
    const result = await testService.testConnection()
    return { success: result.success, message: result.message ?? null }
  }

  const result = await service.testConnection()
  return { success: result.success, message: result.message ?? null }
}
