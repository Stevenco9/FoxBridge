import { useCallback, useEffect, useState } from 'react'
import type { ScannerServerStatus } from '../../shared/models/ScannerServer'
import './ScannerServerControls.css'

const EMPTY_STATUS: ScannerServerStatus = {
  running: false,
  host: '127.0.0.1',
  port: 3847,
  baseUrl: null,
  attendeeCacheLoaded: false,
  attendeeCount: 0,
}

interface ScannerServerControlsProps {
  refreshToken?: number | string
}

export default function ScannerServerControls({ refreshToken }: ScannerServerControlsProps) {
  const [status, setStatus] = useState<ScannerServerStatus>(EMPTY_STATUS)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.getScannerServerStatus) {
      return
    }

    try {
      const nextStatus = await window.electronAPI.getScannerServerStatus()
      setStatus(nextStatus)
    } catch (refreshError) {
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : 'Unable to read scanner server status.'
      setError(message)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus, refreshToken])

  const handleStart = async (): Promise<void> => {
    if (!window.electronAPI?.startScannerServer) {
      setError('Scanner server controls are only available in the desktop app.')
      return
    }

    setIsBusy(true)
    setError(null)

    try {
      const nextStatus = await window.electronAPI.startScannerServer()
      setStatus(nextStatus)
    } catch (startError) {
      const message =
        startError instanceof Error ? startError.message : 'Unable to start scanner server.'
      setError(message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleStop = async (): Promise<void> => {
    if (!window.electronAPI?.stopScannerServer) {
      setError('Scanner server controls are only available in the desktop app.')
      return
    }

    setIsBusy(true)
    setError(null)

    try {
      const nextStatus = await window.electronAPI.stopScannerServer()
      setStatus(nextStatus)
    } catch (stopError) {
      const message =
        stopError instanceof Error ? stopError.message : 'Unable to stop scanner server.'
      setError(message)
    } finally {
      setIsBusy(false)
    }
  }

  if (!window.electronAPI?.getScannerServerStatus) {
    return null
  }

  return (
    <div className="scanner-server-controls">
      <div className="scanner-server-controls__heading">
        <span className="scanner-server-controls__title">Scanner server</span>
        <span
          className={`scanner-server-controls__badge${
            status.running ? ' scanner-server-controls__badge--running' : ''
          }`}
        >
          {status.running ? 'Running' : 'Stopped'}
        </span>
      </div>

      {status.running && status.baseUrl && (
        <p className="scanner-server-controls__url">{status.baseUrl}</p>
      )}

      <p className="scanner-server-controls__meta">
        {status.attendeeCacheLoaded
          ? `${status.attendeeCount} attendee${status.attendeeCount === 1 ? '' : 's'} cached`
          : 'Attendee cache empty — load RegFox data first'}
      </p>

      <div className="scanner-server-controls__actions">
        {status.running ? (
          <button
            type="button"
            className="scanner-server-controls__button"
            onClick={() => void handleStop()}
            disabled={isBusy}
          >
            Stop server
          </button>
        ) : (
          <button
            type="button"
            className="scanner-server-controls__button scanner-server-controls__button--primary"
            onClick={() => void handleStart()}
            disabled={isBusy}
          >
            Start server
          </button>
        )}
      </div>

      {error && (
        <p className="scanner-server-controls__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
