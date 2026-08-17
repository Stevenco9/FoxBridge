import { ipcMain } from 'electron'
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  restartAndInstallUpdate,
} from './updateManager'

/**
 * Renderer-safe update IPC. No feed URL, token, or install path parameters.
 */
export function registerUpdateHandlers(): void {
  ipcMain.removeHandler('update:getStatus')
  ipcMain.handle('update:getStatus', () => getUpdateStatus())

  ipcMain.removeHandler('update:checkForUpdates')
  ipcMain.handle('update:checkForUpdates', () => checkForUpdates())

  ipcMain.removeHandler('update:downloadUpdate')
  ipcMain.handle('update:downloadUpdate', () => downloadUpdate())

  ipcMain.removeHandler('update:restartAndInstallUpdate')
  ipcMain.handle('update:restartAndInstallUpdate', () => restartAndInstallUpdate())
}
