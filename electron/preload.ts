import { contextBridge, ipcRenderer } from 'electron'
import type { Attendee } from '../src/shared/models'

const electronAPI = {
  getAttendees: (): Promise<Attendee[]> => ipcRenderer.invoke('regfox:getAttendees'),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
