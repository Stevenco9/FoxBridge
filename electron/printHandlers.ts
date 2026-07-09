import { BrowserWindow, ipcMain } from 'electron'

export function registerPrintHandlers(): void {
  ipcMain.removeHandler('print:badgePreview')
  ipcMain.handle('print:badgePreview', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      throw new Error('Print is only available in the desktop app window.')
    }

    await new Promise<void>((resolve, reject) => {
      window.webContents.print(
        {
          silent: false,
          printBackground: true,
        },
        (success, failureReason) => {
          if (success) {
            resolve()
            return
          }

          reject(new Error(failureReason || 'Print failed.'))
        },
      )
    })
  })
}
