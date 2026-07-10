import { ipcMain } from 'electron'
import type { Attendee } from '../src/shared/models'
import { getCloudStatus, publishAttendees } from './cloud/publishAttendeesRepository'

export function registerCloudHandlers(): void {
  ipcMain.removeHandler('cloud:getStatus')
  ipcMain.handle('cloud:getStatus', async () => getCloudStatus())

  ipcMain.removeHandler('cloud:publishAttendees')
  ipcMain.handle('cloud:publishAttendees', async (_event, attendees?: Attendee[]) => {
    return publishAttendees(attendees)
  })
}
