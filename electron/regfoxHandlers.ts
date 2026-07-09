import { ipcMain } from 'electron'
import { createRegFoxServiceFromEnv } from '../src/integrations/regfox'
import { setAttendeeCache } from './scannerServer/attendeeCache'

export function registerRegFoxHandlers(): void {
  ipcMain.removeHandler('regfox:getAttendees')
  ipcMain.handle('regfox:getAttendees', async () => {
    const service = createRegFoxServiceFromEnv()
    const attendees = await service.getAttendees()
    setAttendeeCache(attendees)
    return attendees
  })
}
