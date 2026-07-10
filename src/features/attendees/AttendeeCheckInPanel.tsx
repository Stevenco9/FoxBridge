import { useEffect, useState } from 'react'
import type { Attendee } from '../../shared/models'
import './AttendeeCheckInPanel.css'

interface AttendeeCheckInPanelProps {
  attendee: Attendee
  onCheckedIn: (attendee: Attendee) => void
}

function formatCheckInTime(checkedInAt: string): string {
  const parsed = new Date(checkedInAt)
  if (Number.isNaN(parsed.getTime())) {
    return checkedInAt
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function AttendeeCheckInPanel({
  attendee,
  onCheckedIn,
}: AttendeeCheckInPanelProps) {
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadyCheckedInNotice, setAlreadyCheckedInNotice] = useState<string | null>(
    null,
  )

  useEffect(() => {
    setAlreadyCheckedInNotice(null)
    setError(null)
  }, [attendee.id])

  const handleCheckIn = async (): Promise<void> => {
    if (!window.electronAPI?.checkInAttendee) {
      setError('RegFox could not confirm this check-in. Please try again.')
      return
    }

    setIsCheckingIn(true)
    setError(null)
    setAlreadyCheckedInNotice(null)

    try {
      const result = await window.electronAPI.checkInAttendee(attendee.id)
      if (!result.success || !result.attendee) {
        setError(result.message ?? 'RegFox could not confirm this check-in. Please try again.')
        return
      }

      if (result.alreadyCheckedIn) {
        setAlreadyCheckedInNotice(
          result.message ?? 'This attendee was already checked in in RegFox.',
        )
      }

      onCheckedIn(result.attendee)
    } catch {
      setError('RegFox could not confirm this check-in. Please try again.')
    } finally {
      setIsCheckingIn(false)
    }
  }

  const showCheckedInTimeUnavailable =
    attendee.checkedIn && alreadyCheckedInNotice != null && !attendee.checkedInAt

  return (
    <aside className="check-in-panel">
      <h2 className="check-in-panel__title">Check-In</h2>

      {attendee.checkedIn ? (
        <div
          className={`check-in-panel__status${
            alreadyCheckedInNotice ? ' check-in-panel__status--already' : ''
          }`}
          role="status"
        >
          <p className="check-in-panel__status-label">
            {alreadyCheckedInNotice ? 'Already checked in' : 'Checked in'}
          </p>
          {alreadyCheckedInNotice && (
            <p className="check-in-panel__status-note">{alreadyCheckedInNotice}</p>
          )}
          {attendee.checkedInAt && (
            <p className="check-in-panel__status-time">
              {formatCheckInTime(attendee.checkedInAt)}
            </p>
          )}
          {!attendee.checkedInAt && showCheckedInTimeUnavailable && (
            <p className="check-in-panel__status-note">
              Check-in time is not available from the last sync.
            </p>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            className="check-in-panel__button"
            onClick={() => void handleCheckIn()}
            disabled={isCheckingIn}
          >
            {isCheckingIn ? 'Checking in...' : 'Check In'}
          </button>
          {error && (
            <p className="check-in-panel__error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </aside>
  )
}
