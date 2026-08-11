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
  const [enrollmentCode, setEnrollmentCode] = useState('')
  const [deskEnrolled, setDeskEnrolled] = useState(false)
  const [advancedMessage, setAdvancedMessage] = useState<string | null>(null)
  const [isSavingAdvanced, setIsSavingAdvanced] = useState(false)
  const [isEnrolling, setIsEnrolling] = useState(false)

  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)

  useEffect(() => {
    if (!open || !window.electronAPI?.getPublicSettings) {
      return
    }

    void (async () => {
      const settings = await window.electronAPI.getPublicSettings()
      setShowDesktopMealValidation(settings.showDesktopMealValidation)
      setScannerWebAddress(settings.mobileAppUrl ?? settings.mobileScannerUrl ?? '')
      setServiceUrl(settings.mobileServiceUrl ?? '')
      setPublicKey(settings.mobilePublicKey ?? '')
      setConferenceId(settings.conferenceId ?? '')

      if (
        (!settings.mobileServiceUrl || !settings.mobilePublicKey) &&
        window.electronAPI.getFoxBridgeCloudConfigInfo
      ) {
        const cloudInfo = await window.electronAPI.getFoxBridgeCloudConfigInfo()
        setDeskEnrolled(cloudInfo.deskCredentialConfigured === true)
        if (!settings.mobileServiceUrl && cloudInfo.cloudUrl) {
          setServiceUrl(cloudInfo.cloudUrl)
        }
        if (!settings.mobilePublicKey && cloudInfo.publishableKey) {
          setPublicKey(cloudInfo.publishableKey)
        }
        if (
          !(settings.mobileAppUrl ?? settings.mobileScannerUrl) &&
          cloudInfo.scannerWebAddress
        ) {
          setScannerWebAddress(cloudInfo.scannerWebAddress)
        }
      } else if (window.electronAPI.getFoxBridgeCloudConfigInfo) {
        const cloudInfo = await window.electronAPI.getFoxBridgeCloudConfigInfo()
        setDeskEnrolled(cloudInfo.deskCredentialConfigured === true)
      }
    })()
  }, [open, refreshToken])

  const handleMealValidationToggle = async (enabled: boolean): Promise<void> => {
    if (!window.electronAPI?.savePublicSettings) {
      return
    }

    setShowDesktopMealValidation(enabled)
    await window.electronAPI.savePublicSettings({ showDesktopMealValidation: enabled })
    onSettingsSaved?.()
  }

  const handleEnrollDesktop = async (): Promise<void> => {
    if (!window.electronAPI?.enrollFoxBridgeCloudDesktop) {
      return
    }

    setIsEnrolling(true)
    setAdvancedMessage(null)
    try {
      const result = await window.electronAPI.enrollFoxBridgeCloudDesktop({
        enrollmentCode,
      })
      if (!result.success) {
        setAdvancedMessage(result.message ?? 'Unable to enroll this computer.')
        return
      }

      setDeskEnrolled(true)
      setEnrollmentCode('')
      if (result.conferenceId) {
        setConferenceId(result.conferenceId)
      }
      setAdvancedMessage(
        result.conferenceName
          ? `Enrolled for ${result.conferenceName}.`
          : 'This computer is enrolled for FoxBridge Cloud.',
      )
      onSettingsSaved?.()
    } catch (error) {
      setAdvancedMessage(error instanceof Error ? error.message : 'Unable to enroll this computer.')
    } finally {
      setIsEnrolling(false)
    }
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
          setAdvancedMessage(testResult.message ?? 'Could not connect to FoxBridge Cloud.')
          return
        }
      } else if (serviceUrl.trim() && publicKey.trim()) {
        // Public Cloud endpoint only (no legacy privileged key) — required for desk enrollment.
        await window.electronAPI.savePublicSettings({
          mobileServiceUrl: serviceUrl.trim(),
          mobilePublicKey: publicKey.trim(),
          conferenceId: conferenceId.trim() || null,
        })
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

            <h3 className="settings-modal__subtitle">{t('settings.cloudEnrollTitle')}</h3>
            <p className="settings-modal__help">{t('settings.cloudEnrollHelp')}</p>
            {deskEnrolled ? (
              <p className="settings-modal__message" role="status">
                {t('settings.cloudEnrolled')}
              </p>
            ) : (
              <>
                <label className="settings-modal__field">
                  <span>{t('settings.cloudEnrollmentCode')}</span>
                  <input
                    type="text"
                    value={enrollmentCode}
                    onChange={(event) => setEnrollmentCode(event.target.value)}
                    placeholder="ABCD-EFGH-IJKL"
                    autoComplete="off"
                  />
                </label>
                <button
                  type="button"
                  className="settings-modal__button settings-modal__button--primary"
                  onClick={() => void handleEnrollDesktop()}
                  disabled={isEnrolling || !enrollmentCode.trim()}
                >
                  {isEnrolling ? '…' : t('settings.cloudEnrollButton')}
                </button>
              </>
            )}

            <h3 className="settings-modal__subtitle">{t('settings.phoneServiceTitle')}</h3>
            <p className="settings-modal__help">{t('settings.cloudOverrideHelp')}</p>
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
