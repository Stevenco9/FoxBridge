import { useCallback, useEffect, useState } from 'react'
import type { BadgePrintStatus } from '../../shared/models/BadgePrintLog'
import './BadgePrintStatusIndicator.css'

interface BadgePrintStatusIndicatorProps {
  attendeeId: string
  /** Increment after a successful print to reload status. */
  refreshToken?: number
  /** Parent handles clicks (e.g. open print history). No default behavior. */
  onClick: () => void
}

function formatLastPrintedAt(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function buildStatusLabel(status: BadgePrintStatus): string {
  if (status.count <= 0) {
    return 'Never Printed'
  }
  if (status.count === 1) {
    return 'Printed 1 time'
  }
  return `Printed ${status.count} times`
}

export default function BadgePrintStatusIndicator({
  attendeeId,
  refreshToken = 0,
  onClick,
}: BadgePrintStatusIndicatorProps) {
  const [status, setStatus] = useState<BadgePrintStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadStatus = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.getBadgePrintStatus || !attendeeId.trim()) {
      setStatus({ count: 0, lastPrintedAt: null, history: [] })
      return
    }

    setIsLoading(true)
    try {
      const next = await window.electronAPI.getBadgePrintStatus(attendeeId)
      setStatus(next)
    } catch {
      setStatus({ count: 0, lastPrintedAt: null, history: [] })
    } finally {
      setIsLoading(false)
    }
  }, [attendeeId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus, refreshToken])

  const hasPrinted = (status?.count ?? 0) > 0
  const marker = hasPrinted ? '🟢' : '⚪'
  const label = status ? buildStatusLabel(status) : isLoading ? 'Loading…' : 'Never Printed'

  return (
    <button
      type="button"
      className={`badge-print-status${hasPrinted ? ' badge-print-status--printed' : ''}`}
      onClick={onClick}
      aria-live="polite"
    >
      <span className="badge-print-status__primary">
        <span className="badge-print-status__marker" aria-hidden="true">
          {marker}
        </span>
        <span>{label}</span>
      </span>
      {hasPrinted && status?.lastPrintedAt && (
        <span className="badge-print-status__secondary">
          Last: {formatLastPrintedAt(status.lastPrintedAt)}
        </span>
      )}
    </button>
  )
}
