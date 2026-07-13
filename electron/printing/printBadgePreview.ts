import { BrowserWindow } from 'electron'
import type { PrinterInfo, WebContents } from 'electron'
import { captureSelectedPrinterName } from './captureSelectedPrinter'
import {
  getPreferredPrinterName,
  setPreferredPrinterName,
} from './preferredPrinterStore'

const BADGE_WIDTH_IN = 3.9
const BADGE_HEIGHT_IN = 2.4

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

async function readBadgeMarkup(webContents: WebContents): Promise<string> {
  const markup = await webContents.executeJavaScript(`
    (() => {
      const target = document.getElementById('badge-preview-print-target');
      return target ? target.outerHTML : null;
    })()
  `)

  if (typeof markup !== 'string' || markup.trim().length === 0) {
    throw new Error('Badge preview is not ready to print.')
  }

  return markup
}

function buildBadgePrintDocument(badgeMarkup: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>FoxBridge Badge</title>
    <style>
      @page {
        size: ${BADGE_WIDTH_IN}in ${BADGE_HEIGHT_IN}in;
        margin: 0;
      }

      html, body {
        margin: 0;
        padding: 0;
        width: ${BADGE_WIDTH_IN}in;
        height: ${BADGE_HEIGHT_IN}in;
        overflow: hidden;
        background: #ffffff;
      }

      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        box-sizing: border-box;
      }

      .badge-preview {
        width: ${BADGE_WIDTH_IN}in;
        height: ${BADGE_HEIGHT_IN}in;
        margin: 0;
        border: 1px solid #000000;
        background: #ffffff;
        color: #000000;
        display: flex;
        flex-direction: row;
        align-items: stretch;
        justify-content: space-between;
        gap: 0.12in;
        padding: 0.14in 0.16in;
        font-family: Inter, Arial, Helvetica, sans-serif;
        page-break-after: avoid;
        page-break-inside: avoid;
      }

      .badge-preview__content {
        flex: 1;
        min-width: 0;
        height: 100%;
        display: grid;
        grid-template-rows: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
        row-gap: 0.08in;
        align-items: stretch;
        text-align: left;
      }

      .badge-preview__block {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0.02in;
        min-height: 0;
        height: 100%;
        overflow: hidden;
      }

      .badge-preview__block--top {
        gap: 0.008in;
        align-items: stretch;
      }

      .badge-preview__block--empty {
        visibility: hidden;
      }

      .badge-preview__line {
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        word-break: break-word;
        color: #000000;
      }

      .badge-preview__line--top {
        font-weight: 900;
        line-height: 0.92;
        letter-spacing: -0.015em;
        overflow: hidden;
        text-overflow: unset;
        white-space: normal;
      }

      .badge-preview__line--top.badge-preview__line--primary {
        font-size: 32pt;
        line-height: 0.9;
        letter-spacing: -0.02em;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
      }

      .badge-preview__line--top.badge-preview__line--primary.badge-preview__line--fitted-name {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        width: 100%;
        min-height: 0;
        overflow: hidden;
        -webkit-line-clamp: unset;
        line-clamp: unset;
        -webkit-box-orient: unset;
        word-break: normal;
        text-overflow: unset;
      }

      .badge-preview__name-line {
        display: block;
        width: 100%;
        text-align: center;
        white-space: nowrap;
        overflow: visible;
        line-height: inherit;
      }

      .badge-preview__line--top:not(.badge-preview__line--primary) {
        font-size: 26pt;
        font-weight: 900;
        line-height: 0.92;
        letter-spacing: -0.02em;
      }

      .badge-preview__line--middle {
        font-size: 11pt;
        font-weight: 500;
        line-height: 1.1;
      }

      .badge-preview__line--middle.badge-preview__line--primary {
        font-size: 12pt;
        font-weight: 600;
      }

      .badge-preview__line--bottom {
        font-size: 9pt;
        font-weight: 500;
        line-height: 1.12;
      }

      .badge-preview__line--bottom.badge-preview__line--primary {
        font-size: 10pt;
        font-weight: 600;
      }

      .badge-preview__line--name,
      .badge-preview__line--middle.badge-preview__line--name,
      .badge-preview__line--bottom.badge-preview__line--name {
        font-size: 26pt;
        font-weight: 900;
        line-height: 0.9;
        letter-spacing: -0.02em;
        overflow: hidden;
        text-overflow: unset;
        white-space: normal;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
      }

      .badge-preview__line--middle.badge-preview__line--name {
        font-size: 28pt;
      }

      .badge-preview__line--bottom.badge-preview__line--name {
        font-size: 25pt;
      }

      .badge-preview__qr {
        align-self: center;
        width: 0.74in;
        height: 0.74in;
        border: 1px solid #000000;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        padding: 0.03in;
        background: #ffffff;
      }

      .badge-preview__qr svg,
      .badge-preview__qr-image {
        width: 100% !important;
        height: 100% !important;
        display: block;
      }
    </style>
  </head>
  <body>
    ${badgeMarkup}
  </body>
</html>`
}

export async function printBadgePreview(webContents: WebContents): Promise<void> {
  const badgeMarkup = await readBadgeMarkup(webContents)
  const preferredPrinterName = await getPreferredPrinterName()

  const printWindow = new BrowserWindow({
    show: false,
    width: Math.ceil(BADGE_WIDTH_IN * 96),
    height: Math.ceil(BADGE_HEIGHT_IN * 96),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  try {
    await printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(buildBadgePrintDocument(badgeMarkup))}`,
    )

    // Let layout settle before opening the system print dialog.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 150)
    })

    const printers = await printWindow.webContents.getPrintersAsync()
    const deviceName = resolvePrintDeviceName(preferredPrinterName, printers)

    await new Promise<void>((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
          copies: 1,
          pagesPerSheet: 1,
          margins: {
            marginType: 'none',
          },
          pageSize: {
            width: Math.round(BADGE_WIDTH_IN * 25400),
            height: Math.round(BADGE_HEIGHT_IN * 25400),
          },
          ...(deviceName ? { deviceName } : {}),
        },
        (success, failureReason) => {
          if (!success) {
            reject(new Error(failureReason || 'Print failed.'))
            return
          }

          void rememberSuccessfulPrinter(printWindow.webContents, deviceName)
            .then(() => resolve())
            .catch(() => resolve())
        },
      )
    })
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.close()
    }
  }
}
