import { BrowserWindow, ipcMain } from 'electron'
import { printBadgePreview } from './printing/printBadgePreview'

export function registerPrintHandlers(): void {
  ipcMain.removeHandler('print:badgePreview')
  ipcMain.handle('print:badgePreview', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      throw new Error('Print is only available in the desktop app window.')
    }

    await printBadgePreview(window.webContents)
  })
}
