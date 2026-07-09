import { ipcMain } from 'electron'
import { createRegFoxServiceFromEnv } from '../src/integrations/regfox'

export function registerRegFoxHandlers(): void {
  ipcMain.removeHandler('regfox:getAttendees')
  ipcMain.handle('regfox:getAttendees', async () => {
    const service = createRegFoxServiceFromEnv()
    return service.getAttendees()
  })
}
