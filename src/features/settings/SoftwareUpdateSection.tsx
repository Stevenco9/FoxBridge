import { useEffect, useState } from 'react'
import type { AppLanguage } from '../../shared/models/AppSettings'
import type { UpdateStatus } from '../../shared/models/UpdateStatus'
import {
  formatDownloadProgressPercent,
  isCheckForUpdatesEnabled,
  isRestartAndInstallEnabled,
  isUpdateNowEnabled,
} from '../../shared/update/updateUiHelpers'
import { translate } from '../../i18n/messages'

interface SoftwareUpdateSectionProps {
  language: AppLanguage
  active: boolean
  status: UpdateStatus
  onCheckForUpdates: () => Promise<void>
  onDownloadUpdate: () => Promise<void>
  onRestartAndInstallUpdate: () => Promise<void>
  onRefreshUpdateStatus: () => Promise<void>
}

export default function SoftwareUpdateSection({
  language,
  active,
  status,
  onCheckForUpdates,
  onDownloadUpdate,
  onRestartAndInstallUpdate,
  onRefreshUpdateStatus,
}: SoftwareUpdateSectionProps) {
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)
  const [isActing, setIsActing] = useState(false)

  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(language, key, values)

  useEffect(() => {
    if (!active) {
      setRestartConfirmOpen(false)
      return
    }
    void onRefreshUpdateStatus()
  }, [active, onRefreshUpdateStatus])

  const runAction = async (action: () => Promise<void>): Promise<void> => {
    setIsActing(true)
    try {
      await action()
    } finally {
      setIsActing(false)
    }
  }

  const handleRestartRequest = (): void => {
    if (!isRestartAndInstallEnabled(status.state, status.updaterEnabled)) {
      return
    }
    setRestartConfirmOpen(true)
  }

  const handleRestartConfirm = (): void => {
    setRestartConfirmOpen(false)
    void runAction(onRestartAndInstallUpdate)
  }

  const progressPercent = formatDownloadProgressPercent(status.downloadPercent)
  const checkEnabled =
    isCheckForUpdatesEnabled(status.state, status.updaterEnabled) && !isActing
  const updateNowEnabled = isUpdateNowEnabled(status.state, status.updaterEnabled) && !isActing
  const restartEnabled =
    isRestartAndInstallEnabled(status.state, status.updaterEnabled) && !isActing

  const showPrimaryCheckButton =
    status.updaterEnabled &&
    (status.state === 'idle' || status.state === 'upToDate')

  const showCheckAgainButton =
    status.updaterEnabled &&
    (status.state === 'available' || status.state === 'upToDate')

  return (
    <section className="settings-modal__update-section" aria-labelledby="software-update-title">
      <h3 id="software-update-title" className="settings-modal__subtitle">
        {t('settings.update.title')}
      </h3>

      {!status.updaterEnabled && (
        <>
          <p className="settings-modal__update-message">{t('settings.update.devDisabled')}</p>
          <p className="settings-modal__update-version">
            {t('settings.update.version', { version: status.currentVersion })}
          </p>
        </>
      )}

      {status.updaterEnabled && status.state === 'idle' && (
        <>
          <p className="settings-modal__update-message">{t('settings.update.upToDate')}</p>
          <p className="settings-modal__update-version">
            {t('settings.update.version', { version: status.currentVersion })}
          </p>
        </>
      )}

      {status.updaterEnabled && status.state === 'upToDate' && (
        <>
          <p className="settings-modal__update-message">{t('settings.update.upToDate')}</p>
          <p className="settings-modal__update-version">
            {t('settings.update.version', { version: status.currentVersion })}
          </p>
        </>
      )}

      {status.updaterEnabled && status.state === 'checking' && (
        <p className="settings-modal__update-message" role="status">
          {t('settings.update.checking')}
        </p>
      )}

      {status.updaterEnabled && status.state === 'available' && status.availableVersion && (
        <>
          <p className="settings-modal__update-message">
            {t('settings.update.available', { version: status.availableVersion })}
          </p>
          <p className="settings-modal__update-version">
            {t('settings.update.usingVersion', { version: status.currentVersion })}
          </p>
        </>
      )}

      {status.updaterEnabled && status.state === 'downloading' && (
        <>
          <p className="settings-modal__update-message" role="status">
            {t('settings.update.downloading')}
          </p>
          <div
            className="settings-modal__progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent ?? 0}
            aria-label={t('settings.update.downloading')}
          >
            <div
              className="settings-modal__progress-bar"
              style={{ width: `${progressPercent ?? 0}%` }}
            />
          </div>
          <p className="settings-modal__update-version">
            {t('settings.update.downloadProgress', { percent: progressPercent ?? 0 })}
          </p>
        </>
      )}

      {status.updaterEnabled && status.state === 'downloaded' && (
        <p className="settings-modal__update-message">
          {t('settings.update.readyToInstall', {
            version: status.availableVersion ?? status.currentVersion,
          })}
        </p>
      )}

      {status.updaterEnabled && status.state === 'error' && (
        <p className="settings-modal__update-error" role="alert">
          {status.errorSafeMessage ?? t('settings.update.errorFallback')}
        </p>
      )}

      {status.updaterEnabled && status.state === 'available' && (
        <button
          type="button"
          className="settings-modal__button settings-modal__button--primary"
          onClick={() => void runAction(onDownloadUpdate)}
          disabled={!updateNowEnabled}
        >
          {t('settings.update.updateNow')}
        </button>
      )}

      {status.updaterEnabled && status.state === 'downloaded' && (
        <button
          type="button"
          className="settings-modal__button settings-modal__button--primary"
          onClick={handleRestartRequest}
          disabled={!restartEnabled}
        >
          {t('settings.update.restartAndUpdate')}
        </button>
      )}

      {restartConfirmOpen && (
        <div
          className="settings-modal__confirm"
          role="alertdialog"
          aria-labelledby="restart-update-title"
        >
          <h4 id="restart-update-title" className="settings-modal__confirm-title">
            {t('settings.update.restartTitle')}
          </h4>
          <p className="settings-modal__confirm-body">{t('settings.update.restartBody')}</p>
          <div className="settings-modal__confirm-actions">
            <button
              type="button"
              className="settings-modal__button"
              onClick={() => setRestartConfirmOpen(false)}
            >
              {t('settings.update.restartCancel')}
            </button>
            <button
              type="button"
              className="settings-modal__button settings-modal__button--primary"
              onClick={handleRestartConfirm}
            >
              {t('settings.update.restartConfirm')}
            </button>
          </div>
        </div>
      )}

      {status.updaterEnabled && status.state === 'error' && (
        <button
          type="button"
          className="settings-modal__button settings-modal__button--primary"
          onClick={() => void runAction(onCheckForUpdates)}
          disabled={!checkEnabled}
        >
          {t('settings.update.tryAgain')}
        </button>
      )}

      {showPrimaryCheckButton && (
        <button
          type="button"
          className="settings-modal__button"
          onClick={() => void runAction(onCheckForUpdates)}
          disabled={!checkEnabled}
        >
          {t('settings.update.checkForUpdates')}
        </button>
      )}

      {showCheckAgainButton && (
        <button
          type="button"
          className="settings-modal__button"
          onClick={() => void runAction(onCheckForUpdates)}
          disabled={!checkEnabled}
        >
          {t('settings.update.checkAgain')}
        </button>
      )}
    </section>
  )
}
