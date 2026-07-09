import type { PrinterInfo, WebContents } from 'electron'
import { captureSelectedPrinterName } from './captureSelectedPrinter'
import {
  getPreferredPrinterName,
  setPreferredPrinterName,
} from './preferredPrinterStore'

function isPrinterAvailable(printerName: string, printers: PrinterInfo[]): boolean {
  return printers.some((printer) => printer.name === printerName)
}

function resolvePrintDeviceName(
  preferredPrinterName: string | null,
  printers: PrinterInfo[],
): string | undefined {
  if (!preferredPrinterName) {
    return undefined
  }

  if (!isPrinterAvailable(preferredPrinterName, printers)) {
    return undefined
  }

  return preferredPrinterName
}

async function rememberSuccessfulPrinter(
  webContents: WebContents,
  requestedDeviceName: string | undefined,
): Promise<void> {
  const capturedName = await captureSelectedPrinterName({ requestedDeviceName })
  if (!capturedName) {
    return
  }

  const printers = await webContents.getPrintersAsync()
  if (!isPrinterAvailable(capturedName, printers)) {
    return
  }

  await setPreferredPrinterName(capturedName)
}

export async function printBadgePreview(webContents: WebContents): Promise<void> {
  const preferredPrinterName = await getPreferredPrinterName()
  const printers = await webContents.getPrintersAsync()
  const deviceName = resolvePrintDeviceName(preferredPrinterName, printers)

  await new Promise<void>((resolve, reject) => {
    webContents.print(
      {
        silent: false,
        printBackground: true,
        ...(deviceName ? { deviceName } : {}),
      },
      (success, failureReason) => {
        if (!success) {
          reject(new Error(failureReason || 'Print failed.'))
          return
        }

        void rememberSuccessfulPrinter(webContents, deviceName)
          .then(() => resolve())
          .catch(() => resolve())
      },
    )
  })
}
