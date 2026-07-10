import { useEffect, useState } from 'react'
import type { AppLanguage, SetupStatus } from '../../shared/models/AppSettings'
import { translate } from '../../i18n/messages'
import CloudStatusPanel from '../cloud/CloudStatusPanel'
import ScannerServerControls from '../scanner/ScannerServerControls'
import './SettingsModal.css'

interface SettingsModalProps {
  language: AppLanguage
  setupStatus: SetupStatus | null
  open: boolean
  onClose: () => void
  onReopenSetup: () => void
  onLanguageChange: (language: AppLanguage) => void
  onSettingsSaved?: () => void
  refreshToken?: number | string
}

export default function SettingsModal({
  language,
  setupStatus,
  open,
  onClose,
  onReopenSetup,
  onLanguageChange,
  onSettingsSaved,
  refreshToken,
}: SettingsModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showDesktopMealValidation, setShowDesktopMealValidation] = useState(false)
  const [scannerWebAddress, setScannerWebAddress] = useState('')
  const [serviceUrl, setServiceUrl] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [desktopKey, setDesktopKey] = useState('')
  const [conferenceId, setConferenceId] = useState('')
  const [advancedMessage, setAdvancedMessage] = useState<string | null>(null)
  const [isSavingAdvanced, setIsSavingAdvanced] = useState(false)

  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)

  useEffect(() => {
    if (!open || !window.electronAPI?.getPublicSettings) {
      return
    }

    void window.electronAPI.getPublicSettings().then((settings) => {
      setShowDesktopMealValidation(settings.showDesktopMealValidation)
      setScannerWebAddress(settings.mobileAppUrl ?? settings.mobileScannerUrl ?? '')
      setServiceUrl(settings.mobileServiceUrl ?? '')
      setPublicKey(settings.mobilePublicKey ?? '')
      setConferenceId(settings.conferenceId ?? '')
    })
  }, [open, refreshToken])

  const handleMealValidationToggle = async (enabled: boolean): Promise<void> => {
    if (!window.electronAPI?.savePublicSettings) {
      return
    }

    setShowDesktopMealValidation(enabled)
    await window.electronAPI.savePublicSettings({ showDesktopMealValidation: enabled })
    onSettingsSaved?.()
  }

  const handleSaveAdvanced = async (): Promise<void> => {
    if (!window.electronAPI) {
      return
    }

    setIsSavingAdvanced(true)
    setAdvancedMessage(null)

    try {
      if (serviceUrl.trim() && publicKey.trim() && desktopKey.trim()) {
        const testResult = await window.electronAPI.testMobileService({
          serviceUrl,
          publicKey,
          desktopConnectionKey: desktopKey,
          conferenceId: conferenceId.trim() || null,
        })

        if (!testResult.success) {
          setAdvancedMessage(testResult.message ?? 'Could not connect to the phone scanning service.')
          return
        }
      }

      await window.electronAPI.savePublicSettings({
        showDesktopMealValidation,
        mobileAppUrl: scannerWebAddress.trim() || null,
        mobileScannerUrl: scannerWebAddress.trim() || null,
      })

      setAdvancedMessage('Advanced settings saved.')
      onSettingsSaved?.()
    } catch (error) {
      setAdvancedMessage(error instanceof Error ? error.message : 'Unable to save advanced settings.')
    } finally {
      setIsSavingAdvanced(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="settings-modal">
      <div className="settings-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <section className="settings-modal__panel" role="dialog" aria-labelledby="settings-title">
        <h2 id="settings-title" className="settings-modal__title">
          {t('settings.title')}
        </h2>

        <label className="settings-modal__field">
          <span>{t('settings.language')}</span>
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value === 'es' ? 'es' : 'en')}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>

        <button type="button" className="settings-modal__button" onClick={onReopenSetup}>
          {t('settings.reopenSetup')}
        </button>

        {setupStatus?.safeStorage.usingFallback && (
          <p className="settings-modal__warning" role="status">
            Secure storage is unavailable on this computer. Sensitive keys are stored with a fallback
            method. See Advanced for details.
          </p>
        )}

        <button
          type="button"
          className="settings-modal__link"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((openAdvanced) => !openAdvanced)}
        >
          {t('settings.advanced')}
        </button>

        {showAdvanced && (
          <div className="settings-modal__advanced">
            <label className="settings-modal__checkbox">
              <input
                type="checkbox"
                checked={showDesktopMealValidation}
                onChange={(event) => void handleMealValidationToggle(event.target.checked)}
              />
              <span>{t('settings.showDesktopMealValidation')}</span>
            </label>

            <label className="settings-modal__field">
              <span>{t('settings.scannerWebAddress')}</span>
              <input
                type="url"
                value={scannerWebAddress}
                onChange={(event) => setScannerWebAddress(event.target.value)}
                placeholder="https://scanner.example.com"
              />
            </label>

            <h3 className="settings-modal__subtitle">{t('settings.phoneServiceTitle')}</h3>
            <label className="settings-modal__field">
              <span>{t('mobile.serviceUrl')}</span>
              <input type="url" value={serviceUrl} onChange={(event) => setServiceUrl(event.target.value)} />
            </label>
            <label className="settings-modal__field">
              <span>{t('mobile.publicKey')}</span>
              <input
                type="password"
                value={publicKey}
                onChange={(event) => setPublicKey(event.target.value)}
              />
            </label>
            <label className="settings-modal__field">
              <span>{t('mobile.desktopKey')}</span>
              <input
                type="password"
                value={desktopKey}
                onChange={(event) => setDesktopKey(event.target.value)}
              />
            </label>
            <label className="settings-modal__field">
              <span>{t('mobile.conferenceId')} (optional)</span>
              <input
                type="text"
                value={conferenceId}
                onChange={(event) => setConferenceId(event.target.value)}
              />
            </label>

            <button
              type="button"
              className="settings-modal__button settings-modal__button--primary"
              onClick={() => void handleSaveAdvanced()}
              disabled={isSavingAdvanced}
            >
              {isSavingAdvanced ? '…' : t('settings.saveAdvanced')}
            </button>

            {advancedMessage && (
              <p className="settings-modal__message" role="status">
                {advancedMessage}
              </p>
            )}

            <CloudStatusPanel refreshToken={refreshToken} />
            <ScannerServerControls refreshToken={refreshToken} />
            <div className="settings-modal__diagnostics">
              <p>RegFox configured: {setupStatus?.regfoxConfigured ? 'Yes' : 'No'}</p>
              <p>Phone scanning configured: {setupStatus?.mobileConfigured ? 'Yes' : 'No'}</p>
              <p>Phone scanning connected: {setupStatus?.mobileConnected ? 'Yes' : 'No'}</p>
              <p>Attendees loaded: {setupStatus?.attendeeCount ?? 0}</p>
              <p>
                Secure storage:{' '}
                {setupStatus?.safeStorage.available ? 'Available' : 'Fallback in use'}
              </p>
            </div>
          </div>
        )}

        <button type="button" className="settings-modal__button settings-modal__button--primary" onClick={onClose}>
          Close
        </button>
      </section>
    </div>
  )
}
