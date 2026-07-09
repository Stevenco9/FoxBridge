import { ipcMain } from 'electron'
import { isScannerServerAutoStartEnabled } from './scannerServer/config'
import {
  getScannerServerStatus,
  startScannerServer,
  stopScannerServer,
} from './scannerServer/scannerServer'

export function registerScannerServerHandlers(): void {
  ipcMain.removeHandler('scannerServer:getStatus')
  ipcMain.handle('scannerServer:getStatus', () => getScannerServerStatus())

  ipcMain.removeHandler('scannerServer:start')
  ipcMain.handle('scannerServer:start', async (_event, port?: number) => {
    if (port != null && (!Number.isInteger(port) || port < 1 || port > 65535)) {
      throw new Error('Port must be an integer between 1 and 65535.')
    }

    return startScannerServer(port)
  })

  ipcMain.removeHandler('scannerServer:stop')
  ipcMain.handle('scannerServer:stop', async () => stopScannerServer())
}

export async function maybeAutoStartScannerServer(): Promise<void> {
  if (!isScannerServerAutoStartEnabled()) {
    return
  }

  await startScannerServer()
}

export { stopScannerServer }
