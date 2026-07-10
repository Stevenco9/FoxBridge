import { useEffect, useState } from 'react'
import type { AppLanguage } from '../../shared/models/AppSettings'
import { translate } from '../../i18n/messages'
import './MobileServiceSetupModal.css'

interface MobileServiceSetupModalProps {
  language: AppLanguage
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export default function MobileServiceSetupModal({
  language,
  open,
  onClose,
  onComplete,
}: MobileServiceSetupModalProps) {
  const [serviceUrl, setServiceUrl] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [desktopKey, setDesktopKey] = useState('')
  const [conferenceId, setConferenceId] = useState('')
  const [mobileAppUrl, setMobileAppUrl] = useState('')
  const [showTechnicalHelp, setShowTechnicalHelp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)

  useEffect(() => {
    if (!open || !window.electronAPI?.getPublicSettings) {
      return
    }

    void window.electronAPI.getPublicSettings().then((settings) => {
      setServiceUrl(settings.mobileServiceUrl ?? '')
      setPublicKey(settings.mobilePublicKey ?? '')
      setConferenceId(settings.conferenceId ?? '')
      setMobileAppUrl(settings.mobileAppUrl ?? settings.mobileScannerUrl ?? '')
    })
  }, [open])

  const handleSaveAndTest = async (): Promise<void> => {
    if (!window.electronAPI) {
      return
    }

    setIsBusy(true)
    setError(null)

    try {
      const testResult = await window.electronAPI.testMobileService({
        serviceUrl,
        publicKey,
        desktopConnectionKey: desktopKey,
        conferenceId,
      })

      if (!testResult.success) {
        setError(testResult.message ?? 'Could not connect to the mobile service.')
        return
      }

      await window.electronAPI.savePublicSettings({
        mobileAppUrl: mobileAppUrl.trim() || null,
        mobileScannerUrl: mobileAppUrl.trim() || null,
      })

      const setupResult = await window.electronAPI.setupMobileScanner()
      if (!setupResult.success) {
        setError(setupResult.message ?? 'Mobile scanner setup failed.')
        return
      }

      onComplete()
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Mobile scanner setup failed.')
    } finally {
      setIsBusy(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="mobile-setup-modal">
      <div className="mobile-setup-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <section className="mobile-setup-modal__panel" role="dialog" aria-labelledby="mobile-setup-title">
        <h2 id="mobile-setup-title" className="mobile-setup-modal__title">
          {t('mobile.setupTitle')}
        </h2>
        <p className="mobile-setup-modal__text">{t('mobile.text')}</p>

        <label className="mobile-setup-modal__field">
          <span>{t('mobile.serviceUrl')}</span>
          <input type="url" value={serviceUrl} onChange={(event) => setServiceUrl(event.target.value)} />
        </label>
        <label className="mobile-setup-modal__field">
          <span>{t('mobile.publicKey')}</span>
          <input type="password" value={publicKey} onChange={(event) => setPublicKey(event.target.value)} />
        </label>
        <label className="mobile-setup-modal__field">
          <span>{t('mobile.desktopKey')}</span>
          <input type="password" value={desktopKey} onChange={(event) => setDesktopKey(event.target.value)} />
        </label>
        <label className="mobile-setup-modal__field">
          <span>{t('mobile.conferenceId')}</span>
          <input type="text" value={conferenceId} onChange={(event) => setConferenceId(event.target.value)} />
        </label>
        <label className="mobile-setup-modal__field">
          <span>{t('mobile.appUrl')}</span>
          <input type="url" value={mobileAppUrl} onChange={(event) => setMobileAppUrl(event.target.value)} />
          <span className="mobile-setup-modal__hint">{t('mobile.appUrlHelp')}</span>
        </label>

        <button
          type="button"
          className="mobile-setup-modal__link"
          onClick={() => setShowTechnicalHelp((value) => !value)}
        >
          {t('mobile.technicalHelp')}
        </button>
        {showTechnicalHelp && <p className="mobile-setup-modal__help">{t('mobile.technicalText')}</p>}

        {error && (
          <p className="mobile-setup-modal__error" role="alert">
            {error}
          </p>
        )}

        <div className="mobile-setup-modal__actions">
          <button type="button" className="mobile-setup-modal__button" onClick={onClose}>
            {t('connect.close')}
          </button>
          <button
            type="button"
            className="mobile-setup-modal__button mobile-setup-modal__button--primary"
            onClick={() => void handleSaveAndTest()}
            disabled={isBusy}
          >
            {isBusy ? '…' : t('mobile.testContinue')}
          </button>
        </div>
      </section>
    </div>
  )
}
