import { useEffect, useState } from 'react'
import type { BadgePrintLog, BadgePrintStatus } from '../../shared/models/BadgePrintLog'
import './BadgePrintHistoryDialog.css'

interface BadgePrintHistoryDialogProps {
  open: boolean
  attendeeId: string
  attendeeName?: string
  onClose: () => void
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString(undefined, {
    dateStyle: 'medium',
  })
}

function formatTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleTimeString(undefined, {
    timeStyle: 'short',
  })
}

function buildSummary(count: number): string {
  if (count === 1) {
    return 'Badge printed 1 time'
  }
  return `Badge printed ${count} times`
}

export default function BadgePrintHistoryDialog({
  open,
  attendeeId,
  attendeeName,
  onClose,
}: BadgePrintHistoryDialogProps) {
  const [status, setStatus] = useState<BadgePrintStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    let isMounted = true

    async function loadHistory(): Promise<void> {
      if (!window.electronAPI?.getBadgePrintStatus || !attendeeId.trim()) {
        if (isMounted) {
          setStatus({ count: 0, lastPrintedAt: null, history: [] })
          setError(null)
        }
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const next = await window.electronAPI.getBadgePrintStatus(attendeeId)
        if (isMounted) {
          setStatus(next)
        }
      } catch (loadError) {
        if (isMounted) {
          setStatus(null)
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load badge print history.',
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      isMounted = false
    }
  }, [open, attendeeId])

  if (!open) {
    return null
  }

  const history: BadgePrintLog[] = status?.history ?? []
  const count = status?.count ?? 0

  return (
    <div className="badge-print-history" role="presentation">
      <button
        type="button"
        className="badge-print-history__backdrop"
        aria-label="Close badge print history"
        onClick={onClose}
      />
      <section
        className="badge-print-history__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-print-history-title"
      >
        <header className="badge-print-history__header">
          <div>
            <h2 id="badge-print-history-title" className="badge-print-history__title">
              Badge print history
            </h2>
            {attendeeName ? (
              <p className="badge-print-history__subtitle">{attendeeName}</p>
            ) : null}
          </div>
          <button type="button" className="badge-print-history__close" onClick={onClose}>
            Close
          </button>
        </header>

        {isLoading && (
          <div className="badge-print-history__state" role="status">
            Loading print history…
          </div>
        )}

        {error && (
          <div className="badge-print-history__state badge-print-history__state--error" role="alert">
            {error}
          </div>
        )}

        {!isLoading && !error && count === 0 && (
          <div className="badge-print-history__state" role="status">
            No badge has been printed for this attendee.
          </div>
        )}

        {!isLoading && !error && count > 0 && (
          <>
            <p className="badge-print-history__summary">{buildSummary(count)}</p>
            <ul className="badge-print-history__list">
              {history.map((entry) => (
                <li key={entry.id} className="badge-print-history__item">
                  <span className="badge-print-history__date">{formatDate(entry.printedAt)}</span>
                  <span className="badge-print-history__time">{formatTime(entry.printedAt)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
