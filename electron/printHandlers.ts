import { BrowserWindow, ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { printBadgePreview } from './printing/printBadgePreview'
import { printTestBadge } from './printing/printTestBadge'
import {
  getPreferredPrinterName,
  setPreferredPrinterName,
} from './printing/preferredPrinterStore'
import type { PrinterInfoSummary } from '../src/shared/models/AppSettings'

async function listPrinters(webContents: WebContents): Promise<PrinterInfoSummary[]> {
  const printers = await webContents.getPrintersAsync()
  return printers.map((printer) => ({
    name: printer.name,
    isDefault: false,
  }))
}

export function registerPrintHandlers(): void {
  ipcMain.removeHandler('print:badgePreview')
  ipcMain.handle('print:badgePreview', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      throw new Error('Print is only available in the desktop app window.')
    }

    await printBadgePreview(window.webContents)
  })

  ipcMain.removeHandler('print:listPrinters')
  ipcMain.handle('print:listPrinters', async (event) => {
    return listPrinters(event.sender)
  })

  ipcMain.removeHandler('print:getPreferredPrinter')
  ipcMain.handle('print:getPreferredPrinter', async () => getPreferredPrinterName())

  ipcMain.removeHandler('print:setPreferredPrinter')
  ipcMain.handle('print:setPreferredPrinter', async (_event, printerName: string) => {
    await setPreferredPrinterName(printerName)
    return getPreferredPrinterName()
  })

  ipcMain.removeHandler('print:testBadge')
  ipcMain.handle('print:testBadge', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      throw new Error('Print is only available in the desktop app window.')
    }

    await printTestBadge(window.webContents)
  })
}
