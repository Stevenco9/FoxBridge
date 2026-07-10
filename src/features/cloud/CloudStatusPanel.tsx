import { useCallback, useEffect, useState } from 'react'
import type { CloudStatus } from '../../shared/models/CloudStatus'
import './CloudStatusPanel.css'

const EMPTY_STATUS: CloudStatus = {
  configured: false,
  connected: false,
  conferenceId: null,
  conferenceName: null,
  lastPublishAt: null,
  lastPublishAttendeeCount: null,
  lastPublishError: null,
}

interface CloudStatusPanelProps {
  refreshToken?: number | string
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Never'
  }

  return new Date(value).toLocaleString()
}

export default function CloudStatusPanel({ refreshToken }: CloudStatusPanelProps) {
  const [status, setStatus] = useState<CloudStatus>(EMPTY_STATUS)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.getCloudStatus) {
      return
    }

    try {
      const nextStatus = await window.electronAPI.getCloudStatus()
      setStatus(nextStatus)
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : 'Unable to read cloud status.'
      setError(message)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus, refreshToken])

  const handlePublish = async (): Promise<void> => {
    if (!window.electronAPI?.publishAttendees) {
      setError('Cloud publish is only available in the desktop app.')
      return
    }

    setIsBusy(true)
    setError(null)

    try {
      const result = await window.electronAPI.publishAttendees()
      if (!result.success && result.error) {
        setError(result.error)
      }

      await refreshStatus()
    } catch (publishError) {
      const message =
        publishError instanceof Error ? publishError.message : 'Unable to publish attendees.'
      setError(message)
    } finally {
      setIsBusy(false)
    }
  }

  if (!window.electronAPI?.getCloudStatus) {
    return null
  }

  const connectionLabel = !status.configured
    ? 'Not configured'
    : status.connected
      ? 'Connected'
      : 'Unavailable'

  const conferenceLabel =
    status.conferenceName ??
    (status.conferenceId ? `ID ${status.conferenceId.slice(0, 8)}…` : 'Not set')

  return (
    <div className="cloud-status-panel">
      <div className="cloud-status-panel__heading">
        <span className="cloud-status-panel__title">Cloud status</span>
        <span
          className={`cloud-status-panel__badge${
            status.connected ? ' cloud-status-panel__badge--connected' : ''
          }`}
        >
          {connectionLabel}
        </span>
      </div>

      <dl className="cloud-status-panel__details">
        <div className="cloud-status-panel__row">
          <dt>Conference</dt>
          <dd>{conferenceLabel}</dd>
        </div>
        <div className="cloud-status-panel__row">
          <dt>Last publish</dt>
          <dd>{formatTimestamp(status.lastPublishAt)}</dd>
        </div>
        <div className="cloud-status-panel__row">
          <dt>Uploaded</dt>
          <dd>
            {status.lastPublishAttendeeCount != null
              ? `${status.lastPublishAttendeeCount} attendee${status.lastPublishAttendeeCount === 1 ? '' : 's'}`
              : 'None yet'}
          </dd>
        </div>
      </dl>

      <div className="cloud-status-panel__actions">
        <button
          type="button"
          className="cloud-status-panel__button cloud-status-panel__button--primary"
          onClick={() => void handlePublish()}
          disabled={isBusy || !status.configured}
        >
          Publish attendees
        </button>
      </div>

      {!status.configured && (
        <p className="cloud-status-panel__hint">
          Add Supabase settings to `.env` to enable cloud publish.
        </p>
      )}

      {(error || status.lastPublishError) && (
        <p className="cloud-status-panel__error" role="alert">
          {error ?? status.lastPublishError}
        </p>
      )}
    </div>
  )
}
