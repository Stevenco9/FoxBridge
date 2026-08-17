import { BrowserWindow } from 'electron'
import type { UpdateStatus } from '../../src/shared/models/UpdateStatus'

export function notifyUpdateStatusChanged(status: UpdateStatus): void {
  const payload: UpdateStatus = { ...status }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('update:statusChanged', payload)
    }
  }
}
