import { BrowserWindow } from 'electron'

/** Soft notify renderer that in-memory attendee effective state may have changed. */
export function notifyAttendeesChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('attendees:changed')
    }
  }
}
