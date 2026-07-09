import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

const STORE_FILENAME = 'preferred-printer.json'

interface PreferredPrinterStoreData {
  printerName: string
}

function getStorePath(): string {
  return path.join(app.getPath('userData'), STORE_FILENAME)
}

export async function getPreferredPrinterName(): Promise<string | null> {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf8')
    const data = JSON.parse(raw) as PreferredPrinterStoreData
    const printerName = data.printerName?.trim()
    return printerName || null
  } catch {
    return null
  }
}

export async function setPreferredPrinterName(printerName: string): Promise<void> {
  const normalized = printerName.trim()
  if (!normalized) {
    return
  }

  const data: PreferredPrinterStoreData = { printerName: normalized }
  await fs.writeFile(getStorePath(), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}
