import { randomUUID } from 'node:crypto'
import type {
  BadgePrintLog,
  BadgePrintStatus,
  RecordBadgePrintInput,
} from '../../src/shared/models/BadgePrintLog'
import { getDatabase } from './database'

interface BadgePrintLogRow {
  id: string
  attendee_id: string
  printed_at: string
  printer_name: string | null
  workstation: string | null
  operator: string | null
  notes: string | null
}

function mapRow(row: BadgePrintLogRow): BadgePrintLog {
  return {
    id: row.id,
    attendeeId: row.attendee_id,
    printedAt: row.printed_at,
    printerName: row.printer_name,
    workstation: row.workstation,
    operator: row.operator,
    notes: row.notes,
  }
}

/**
 * Records a badge print event for an attendee.
 * Does not enforce uniqueness — reprints are allowed and each become a new log row.
 */
export function recordBadgePrint(input: RecordBadgePrintInput): BadgePrintLog {
  const attendeeId = input.attendeeId.trim()
  if (!attendeeId) {
    throw new Error('attendeeId is required to record a badge print.')
  }

  const id = randomUUID()
  const printedAt = input.printedAt?.trim() || new Date().toISOString()
  const printerName = input.printerName?.trim() || null
  const workstation = input.workstation?.trim() || null
  const operator = input.operator?.trim() || null
  const notes = input.notes?.trim() || null

  const db = getDatabase()
  db.prepare(
    `INSERT INTO badge_print_logs (
      id, attendee_id, printed_at, printer_name, workstation, operator, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, attendeeId, printedAt, printerName, workstation, operator, notes)

  return {
    id,
    attendeeId,
    printedAt,
    printerName,
    workstation,
    operator,
    notes,
  }
}

/** Returns all print logs for an attendee, newest first. */
export function getBadgePrintHistory(attendeeId: string): BadgePrintLog[] {
  const id = attendeeId.trim()
  if (!id) {
    return []
  }

  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT id, attendee_id, printed_at, printer_name, workstation, operator, notes
       FROM badge_print_logs
       WHERE attendee_id = ?
       ORDER BY printed_at DESC, id DESC`,
    )
    .all(id) as BadgePrintLogRow[]

  return rows.map(mapRow)
}

/** Returns how many times a badge has been printed for an attendee. */
export function getBadgePrintCount(attendeeId: string): number {
  const id = attendeeId.trim()
  if (!id) {
    return 0
  }

  const db = getDatabase()
  const row = db
    .prepare(
      `SELECT COUNT(*) AS print_count
       FROM badge_print_logs
       WHERE attendee_id = ?`,
    )
    .get(id) as { print_count: number }

  return Number(row.print_count) || 0
}

/** Returns the most recent print log for an attendee, or null if never printed. */
export function getLastBadgePrint(attendeeId: string): BadgePrintLog | null {
  const id = attendeeId.trim()
  if (!id) {
    return null
  }

  const db = getDatabase()
  const row = db
    .prepare(
      `SELECT id, attendee_id, printed_at, printer_name, workstation, operator, notes
       FROM badge_print_logs
       WHERE attendee_id = ?
       ORDER BY printed_at DESC, id DESC
       LIMIT 1`,
    )
    .get(id) as BadgePrintLogRow | undefined

  return row ? mapRow(row) : null
}

/**
 * Read-only aggregate for the renderer: count, last print time, and full history.
 * History is newest-first; count/lastPrintedAt are derived from that list.
 */
export function getBadgePrintStatus(attendeeId: string): BadgePrintStatus {
  const history = getBadgePrintHistory(attendeeId)
  return {
    count: history.length,
    lastPrintedAt: history[0]?.printedAt ?? null,
    history,
  }
}
