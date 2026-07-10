import { useCallback, useEffect, useState } from 'react'
import type { AppLanguage, AppSettingsPublic, SetupStatus } from '../../shared/models/AppSettings'
import { translate } from '../../i18n/messages'
import './SetupWizard.css'

type WizardStep = 'welcome' | 'language' | 'regfox' | 'printer' | 'mobile' | 'ready'

interface SetupWizardProps {
  onComplete: () => void
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome')
  const [language, setLanguage] = useState<AppLanguage>('en')
  const [settings, setSettings] = useState<AppSettingsPublic | null>(null)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const [apiKey, setApiKey] = useState('')
  const [eventId, setEventId] = useState('')
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [regfoxConnected, setRegfoxConnected] = useState(false)

  const [printers, setPrinters] = useState<Array<{ name: string; isDefault: boolean }>>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [printerSkipped, setPrinterSkipped] = useState(false)

  const [mobileReady, setMobileReady] = useState(false)

  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
      translate(language, key, values),
    [language],
  )

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.getSetupStatus) {
      return
    }

    const [nextSettings, nextStatus] = await Promise.all([
      window.electronAPI.getPublicSettings(),
      window.electronAPI.getSetupStatus(),
    ])
    setSettings(nextSettings)
    setSetupStatus(nextStatus)
    setLanguage(nextSettings.language)
    setEventId(nextSettings.regfoxEventId ?? '')
    setMobileReady(nextStatus.mobileConnected)
    setAttendeeCount(nextStatus.attendeeCount)
    setRegfoxConnected(nextStatus.regfoxConfigured && nextStatus.attendeeCount > 0)
  }, [])

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      if (!window.electronAPI?.initializeSettings) {
        return
      }

      await window.electronAPI.initializeSettings()
      await refreshStatus()
    }

    void bootstrap()
  }, [refreshStatus])

  const loadPrinters = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.listPrinters) {
      return
    }

    const list = await window.electronAPI.listPrinters()
    setPrinters(list)
    const preferred = await window.electronAPI.getPreferredPrinter()
    if (preferred) {
      setSelectedPrinter(preferred)
    } else {
      const defaultPrinter = list.find((printer) => printer.isDefault)
      if (defaultPrinter) {
        setSelectedPrinter(defaultPrinter.name)
      }
    }
  }, [])

  useEffect(() => {
    if (step === 'printer') {
      void loadPrinters()
    }
  }, [step, loadPrinters])

  const handleLanguageContinue = async (): Promise<void> => {
    if (!window.electronAPI?.savePublicSettings) {
      return
    }

    await window.electronAPI.savePublicSettings({ language })
    setStep('regfox')
  }

  const handleRegFoxConnect = async (): Promise<void> => {
    if (!window.electronAPI?.connectRegFox) {
      return
    }

    setIsBusy(true)
    setError(null)

    try {
      const result = await window.electronAPI.connectRegFox({ apiKey, eventId })
      if (!result.success) {
        setError(result.message ?? 'Could not connect to RegFox.')
        return
      }

      setRegfoxConnected(true)
      setAttendeeCount(result.attendeeCount)
      await refreshStatus()
      setStep('printer')
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : 'Could not connect to RegFox.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handlePrinterContinue = async (): Promise<void> => {
    if (selectedPrinter && window.electronAPI?.setPreferredPrinter) {
      await window.electronAPI.setPreferredPrinter(selectedPrinter)
    }

    setPrinterSkipped(!selectedPrinter)
    setStep('mobile')
  }

  const handlePrintTest = async (): Promise<void> => {
    if (!window.electronAPI?.printTestBadge) {
      return
    }

    if (selectedPrinter) {
      await window.electronAPI.setPreferredPrinter(selectedPrinter)
    }

    setIsBusy(true)
    setError(null)

    try {
      await window.electronAPI.printTestBadge()
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : 'Test print failed.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleFinish = async (): Promise<void> => {
    if (!window.electronAPI?.completeSetup) {
      return
    }

    await window.electronAPI.completeSetup()
    onComplete()
  }

  const conferenceLabel = settings?.conferenceName ?? setupStatus?.conferenceName ?? 'Conference'

  return (
    <div className="setup-wizard">
      <div className="setup-wizard__card">
        {step === 'welcome' && (
          <>
            <h1 className="setup-wizard__title">{t('welcome.title')}</h1>
            <p className="setup-wizard__text">{t('welcome.text')}</p>
            <button
              type="button"
              className="setup-wizard__button setup-wizard__button--primary"
              onClick={() => setStep('language')}
            >
              {t('welcome.start')}
            </button>
          </>
        )}

        {step === 'language' && (
          <>
            <h1 className="setup-wizard__title">{t('language.title')}</h1>
            <p className="setup-wizard__text">{t('language.text')}</p>
            <div className="setup-wizard__choices">
              <button
                type="button"
                className={`setup-wizard__choice${language === 'en' ? ' setup-wizard__choice--selected' : ''}`}
                onClick={() => setLanguage('en')}
              >
                {t('language.english')}
              </button>
              <button
                type="button"
                className={`setup-wizard__choice${language === 'es' ? ' setup-wizard__choice--selected' : ''}`}
                onClick={() => setLanguage('es')}
              >
                {t('language.spanish')}
              </button>
            </div>
            <div className="setup-wizard__actions">
              <button type="button" className="setup-wizard__button" onClick={() => setStep('welcome')}>
                {t('common.back')}
              </button>
              <button
                type="button"
                className="setup-wizard__button setup-wizard__button--primary"
                onClick={() => void handleLanguageContinue()}
              >
                {t('language.continue')}
              </button>
            </div>
          </>
        )}

        {step === 'regfox' && (
          <>
            <h1 className="setup-wizard__title">{t('regfox.title')}</h1>
            <p className="setup-wizard__text">{t('regfox.text')}</p>
            <label className="setup-wizard__field">
              <span>{t('regfox.apiKey')}</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="setup-wizard__field">
              <span>{t('regfox.pageId')}</span>
              <input
                type="text"
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
                autoComplete="off"
              />
            </label>
            {regfoxConnected && (
              <p className="setup-wizard__success">{t('regfox.connected', { count: attendeeCount })}</p>
            )}
            {error && (
              <p className="setup-wizard__error" role="alert">
                {error}
              </p>
            )}
            <div className="setup-wizard__actions">
              <button type="button" className="setup-wizard__button" onClick={() => setStep('language')}>
                {t('regfox.back')}
              </button>
              <button
                type="button"
                className="setup-wizard__button setup-wizard__button--primary"
                onClick={() => void handleRegFoxConnect()}
                disabled={isBusy}
              >
                {isBusy ? '…' : regfoxConnected ? t('common.next') : t('regfox.connect')}
              </button>
            </div>
          </>
        )}

        {step === 'printer' && (
          <>
            <h1 className="setup-wizard__title">{t('printer.title')}</h1>
            <p className="setup-wizard__text">{t('printer.text')}</p>
            <label className="setup-wizard__field">
              <span>{t('printer.select')}</span>
              <select
                value={selectedPrinter}
                onChange={(event) => setSelectedPrinter(event.target.value)}
              >
                <option value="">Choose a printer…</option>
                {printers.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.name}
                    {printer.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p className="setup-wizard__error" role="alert">
                {error}
              </p>
            )}
            <div className="setup-wizard__actions setup-wizard__actions--stack">
              <button
                type="button"
                className="setup-wizard__button"
                onClick={() => void handlePrintTest()}
                disabled={isBusy || !selectedPrinter}
              >
                {t('printer.test')}
              </button>
              <button
                type="button"
                className="setup-wizard__button setup-wizard__button--primary"
                onClick={() => void handlePrinterContinue()}
              >
                {selectedPrinter ? t('printer.continue') : t('printer.skip')}
              </button>
              <button type="button" className="setup-wizard__button" onClick={() => setStep('regfox')}>
                {t('printer.back')}
              </button>
            </div>
          </>
        )}

        {step === 'mobile' && (
          <>
            <h1 className="setup-wizard__title">{t('mobile.title')}</h1>
            <p className="setup-wizard__text">{t('mobile.simpleText')}</p>

            {mobileReady && <p className="setup-wizard__success">{t('mobile.ready')}</p>}

            {error && (
              <p className="setup-wizard__error" role="alert">
                {error}
              </p>
            )}

            <div className="setup-wizard__actions">
              <button type="button" className="setup-wizard__button" onClick={() => setStep('printer')}>
                {t('mobile.back')}
              </button>
              <button
                type="button"
                className="setup-wizard__button setup-wizard__button--primary"
                onClick={() => setStep('ready')}
              >
                {t('mobile.skipForNow')}
              </button>
            </div>
          </>
        )}

        {step === 'ready' && (
          <>
            <h1 className="setup-wizard__title">{t('ready.title')}</h1>
            <p className="setup-wizard__text">{t('ready.text')}</p>
            <ul className="setup-wizard__summary">
              <li>{conferenceLabel}</li>
              <li>{t('ready.attendees', { count: setupStatus?.attendeeCount ?? attendeeCount })}</li>
              <li>
                {setupStatus?.preferredPrinterName && setupStatus.printerAvailable
                  ? t('ready.printerReady')
                  : printerSkipped || !setupStatus?.preferredPrinterName
                    ? t('ready.printerUnavailable')
                    : t('ready.printerReady')}
              </li>
              <li>
                {setupStatus?.mobileConnected || mobileReady
                  ? t('ready.mobileReady')
                  : t('ready.mobileLater')}
              </li>
            </ul>
            <button
              type="button"
              className="setup-wizard__button setup-wizard__button--primary setup-wizard__button--large"
              onClick={() => void handleFinish()}
            >
              {t('ready.finish')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
