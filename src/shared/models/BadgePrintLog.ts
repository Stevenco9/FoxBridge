/**
 * Local desktop badge print history (Sprint 19.1–19.3).
 */

export interface BadgePrintLog {
  id: string
  attendeeId: string
  /** ISO 8601 timestamp when the badge was printed. */
  printedAt: string
  printerName: string | null
  workstation: string | null
  operator: string | null
  notes: string | null
}

/** Input for recording a badge print event. Id and printedAt are assigned by the repository when omitted. */
export interface RecordBadgePrintInput {
  attendeeId: string
  printedAt?: string
  printerName?: string | null
  workstation?: string | null
  operator?: string | null
  notes?: string | null
}

/** Read-only summary returned to the renderer via IPC (Sprint 19.3). */
export interface BadgePrintStatus {
  count: number
  /** ISO 8601 timestamp of the most recent print, or null when never printed. */
  lastPrintedAt: string | null
  /** Newest-first print history for the attendee. */
  history: BadgePrintLog[]
}
