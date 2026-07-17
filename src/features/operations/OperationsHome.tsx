import { useCallback, useEffect, useState } from 'react'
import type { AppLanguage, SetupStatus } from '../../shared/models/AppSettings'
import { translate } from '../../i18n/messages'
import './OperationsHome.css'

interface OperationsHomeProps {
  language: AppLanguage
  onConnectPhone: () => void
  onOpenMealDashboard: () => void
  onOpenSettings: () => void
  refreshToken?: number | string
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Not yet'
  }

  return new Date(value).toLocaleString()
}

export default function OperationsHome({
  language,
  onConnectPhone,
  onOpenMealDashboard,
  onOpenSettings,
  refreshToken,
}: OperationsHomeProps) {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)

  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
      translate(language, key, values),
    [language],
  )

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.getSetupStatus) {
      return
    }

    const nextStatus = await window.electronAPI.getSetupStatus()
    setStatus(nextStatus)
    setUpdateMessage(nextStatus.lastMobilePublishWarning)
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus, refreshToken])

  const handleUpdateRegistrations = async (): Promise<void> => {
    if (!window.electronAPI?.updateRegistrations) {
      return
    }

    setIsUpdating(true)
    setUpdateMessage(null)

    try {
      const result = await window.electronAPI.updateRegistrations()
      if (!result.success) {
        setUpdateMessage(result.message ?? 'Unable to update registrations.')
      } else if (result.publishError) {
        setUpdateMessage(result.publishError)
      }

      await refreshStatus()
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message : 'Unable to update registrations.')
    } finally {
      setIsUpdating(false)
    }
  }

  const conferenceName = status?.conferenceName ?? 'Conference'
  const attendeeLabel =
    status && status.attendeeCount > 0
      ? t('home.status.attendees', { count: status.attendeeCount })
      : t('home.status.registration')

  return (
    <section className="operations-home">
      <div className="operations-home__header">
        <div>
          <p className="operations-home__label">{t('home.conference')}</p>
          <h2 className="operations-home__title">{conferenceName}</h2>
        </div>
        <button type="button" className="operations-home__settings" onClick={onOpenSettings}>
          ⚙
        </button>
      </div>

      <ul className="operations-home__status">
        <li className="operations-home__status-row">
          <span>{attendeeLabel}</span>
          <button
            type="button"
            className="operations-home__refresh"
            onClick={() => void handleUpdateRegistrations()}
            disabled={isUpdating}
          >
            {isUpdating ? t('home.updating') : t('home.action.refresh')}
          </button>
        </li>
        <li>
          {status?.preferredPrinterName && status.printerAvailable
            ? t('home.status.printerReady')
            : t('home.status.printerUnavailable')}
        </li>
        <li>
          {t('home.status.lastUpdate')}: {formatTimestamp(status?.lastAttendeeUpdate ?? null)}
        </li>
      </ul>

      <div className="operations-home__actions">
        <button type="button" className="operations-home__action" onClick={onConnectPhone}>
          {t('home.action.connectPhone')}
        </button>
        <button
          type="button"
          className="operations-home__action operations-home__action--secondary"
          onClick={onOpenMealDashboard}
        >
          {t('home.action.mealDashboard')}
        </button>
      </div>

      {updateMessage && (
        <p className="operations-home__message" role="alert">
          {updateMessage}
        </p>
      )}
    </section>
  )
}
