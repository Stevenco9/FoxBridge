import { contextBridge, ipcRenderer } from 'electron'
import type { Attendee } from '../src/shared/models'

const electronAPI = {
  getAttendees: (): Promise<Attendee[]> => ipcRenderer.invoke('regfox:getAttendees'),
  printBadgePreview: (): Promise<void> => ipcRenderer.invoke('print:badgePreview'),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
