import { ipcMain } from 'electron'
import {
  getEventAccessSessionStatus,
  lockEventAccessSession,
} from './eventAccessSession'

/**
 * Renderer-safe event access status. Lock is available for trusted UI flows
 * (Sprint 23.2 reopen wizard). There is no renderer "unlock" IPC — sessions
 * are established only from trusted main-process authorization paths.
 */
export function registerEventAccessSessionHandlers(): void {
  ipcMain.removeHandler('session:getEventAccessStatus')
  ipcMain.handle('session:getEventAccessStatus', () => getEventAccessSessionStatus())

  ipcMain.removeHandler('session:lockEventAccess')
  ipcMain.handle('session:lockEventAccess', () => lockEventAccessSession())
}
