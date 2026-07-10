import { ipcMain } from 'electron'
import { createRegFoxServiceFromSettings } from './regfox/regfoxConfig'
import { getAttendeeCache } from './scannerServer/attendeeCache'
import {
  connectRegFox,
  loadRegFoxAttendees,
  updateRegistrations,
} from './settings/settingsService'

export function registerRegFoxHandlers(): void {
  ipcMain.removeHandler('regfox:getAttendees')
  ipcMain.handle('regfox:getAttendees', async () => {
    const result = await loadRegFoxAttendees()
    if (!result.success) {
      throw new Error(result.message ?? 'Unable to load attendees from RegFox.')
    }

    return getAttendeeCache()
  })

  ipcMain.removeHandler('regfox:connect')
  ipcMain.handle(
    'regfox:connect',
    async (_event, payload: { apiKey: string; eventId: string }) =>
      connectRegFox(payload.apiKey, payload.eventId),
  )

  ipcMain.removeHandler('regfox:updateRegistrations')
  ipcMain.handle('regfox:updateRegistrations', async () => updateRegistrations())
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
