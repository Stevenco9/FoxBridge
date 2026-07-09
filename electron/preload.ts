import { contextBridge, ipcRenderer } from 'electron'
import type { Attendee } from '../src/shared/models'
import type {
  StoredMealValidation,
  ValidateMealRequest,
  ValidateMealResult,
} from '../src/shared/models/MealValidation'

const electronAPI = {
  getAttendees: (): Promise<Attendee[]> => ipcRenderer.invoke('regfox:getAttendees'),
  printBadgePreview: (): Promise<void> => ipcRenderer.invoke('print:badgePreview'),
  getMealValidationsForAttendee: (attendeeId: string): Promise<StoredMealValidation[]> =>
    ipcRenderer.invoke('meals:getValidationsForAttendee', attendeeId),
  validateMeal: (request: ValidateMealRequest): Promise<ValidateMealResult> =>
    ipcRenderer.invoke('meals:validateMeal', request),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
