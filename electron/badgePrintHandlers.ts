import { ipcMain } from 'electron'
import { getBadgePrintStatus } from './db/badgePrintLogRepository'
import type { BadgePrintStatus } from '../src/shared/models/BadgePrintLog'

const EMPTY_STATUS: BadgePrintStatus = {
  count: 0,
  lastPrintedAt: null,
  history: [],
}

/**
 * Read-only badge print history for the renderer (Sprint 19.3).
 * Does not record prints — recording stays in the print success path (19.2).
 */
export function registerBadgePrintHandlers(): void {
  ipcMain.removeHandler('print:getBadgePrintStatus')
  ipcMain.handle(
    'print:getBadgePrintStatus',
    (_event, attendeeId: string): BadgePrintStatus => {
      if (!attendeeId?.trim()) {
        return EMPTY_STATUS
      }

      return getBadgePrintStatus(attendeeId.trim())
    },
  )
}
