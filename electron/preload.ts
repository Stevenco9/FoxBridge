import { contextBridge, ipcRenderer } from 'electron'
import type { Attendee } from '../src/shared/models'
import type {
  StoredMealValidation,
  ValidateMealRequest,
  ValidateMealResult,
} from '../src/shared/models/MealValidation'
import type { CloudStatus, PublishAttendeesResult } from '../src/shared/models/CloudStatus'
import type { ScannerServerStatus } from '../src/shared/models/ScannerServer'

const electronAPI = {
  getAttendees: (): Promise<Attendee[]> => ipcRenderer.invoke('regfox:getAttendees'),
  printBadgePreview: (): Promise<void> => ipcRenderer.invoke('print:badgePreview'),
  getMealValidationsForAttendee: (attendeeId: string): Promise<StoredMealValidation[]> =>
    ipcRenderer.invoke('meals:getValidationsForAttendee', attendeeId),
  validateMeal: (request: ValidateMealRequest): Promise<ValidateMealResult> =>
    ipcRenderer.invoke('meals:validateMeal', request),
  getScannerServerStatus: (): Promise<ScannerServerStatus> =>
    ipcRenderer.invoke('scannerServer:getStatus'),
  startScannerServer: (port?: number): Promise<ScannerServerStatus> =>
    ipcRenderer.invoke('scannerServer:start', port),
  stopScannerServer: (): Promise<ScannerServerStatus> =>
    ipcRenderer.invoke('scannerServer:stop'),
  getCloudStatus: (): Promise<CloudStatus> => ipcRenderer.invoke('cloud:getStatus'),
  publishAttendees: (): Promise<PublishAttendeesResult> =>
    ipcRenderer.invoke('cloud:publishAttendees'),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
