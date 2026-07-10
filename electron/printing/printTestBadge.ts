import { BrowserWindow } from 'electron'
import type { WebContents } from 'electron'
import {
  getPreferredPrinterName,
  setPreferredPrinterName,
} from './preferredPrinterStore'

const TEST_BADGE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>FoxBridge Test Badge</title>
    <style>
      @page { size: 3.9in 2.4in; margin: 0; }
      body {
        margin: 0;
        width: 3.9in;
        height: 2.4in;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Inter, Arial, sans-serif;
        background: #ffffff;
      }
      .badge {
        text-align: center;
        padding: 0.25in;
      }
      .title {
        font-size: 18pt;
        font-weight: 800;
        margin: 0 0 0.1in;
      }
      .subtitle {
        font-size: 11pt;
        margin: 0;
        color: #374151;
      }
    </style>
  </head>
  <body>
    <div class="badge">
      <p class="title">Test Badge</p>
      <p class="subtitle">FoxBridge printer check</p>
    </div>
  </body>
</html>`

export async function printTestBadge(_webContents: WebContents): Promise<void> {
  const preferredPrinterName = await getPreferredPrinterName()

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  try {
    await printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(TEST_BADGE_HTML)}`,
    )

    const printers = await printWindow.webContents.getPrintersAsync()
    const deviceName =
      preferredPrinterName && printers.some((printer) => printer.name === preferredPrinterName)
        ? preferredPrinterName
        : undefined

    await new Promise<void>((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
          ...(deviceName ? { deviceName } : {}),
        },
        (success, failureReason) => {
          if (!success) {
            reject(new Error(failureReason || 'Test print failed.'))
            return
          }

          if (deviceName) {
            void setPreferredPrinterName(deviceName)
          }

          resolve()
        },
      )
    })
  } finally {
    printWindow.close()
  }
}
