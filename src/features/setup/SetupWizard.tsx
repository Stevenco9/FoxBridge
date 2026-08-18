import { useCallback, useEffect, useState } from 'react'
import type { AppLanguage, AppSettingsPublic, SetupStatus } from '../../shared/models/AppSettings'
import { translate } from '../../i18n/messages'
import './SetupWizard.css'

type WizardStep =
  | 'welcome'
  | 'language'
  | 'connect'
  | 'setupMyEvent'
  | 'joinExisting'
  | 'printer'
  | 'mobile'
  | 'ready'

type UnlockPath = 'principal' | 'linked' | null

interface SetupWizardProps {
  onComplete: () => void
  /** Called after Principal claim or Linked redeem establishes process access. */
  onEventUnlocked?: () => void
  /**
   * When true (returning install / reopen lock), skip welcome and start at Connect.
   * Language preference is already persisted.
   */
  returningUser?: boolean
}

export default function SetupWizard({
  onComplete,
  onEventUnlocked,
  returningUser = false,
}: SetupWizardProps) {
  const [step, setStep] = useState<WizardStep | null>(null)
  const [language, setLanguage] = useState<AppLanguage>('en')
  const [settings, setSettings] = useState<AppSettingsPublic | null>(null)
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [unlockPath, setUnlockPath] = useState<UnlockPath>(null)
  const [needsTransferConfirmation, setNeedsTransferConfirmation] = useState(false)

  // Principal — never prefilled from secrets; both required each unlock.
  const [apiKey, setApiKey] = useState('')
  const [eventId, setEventId] = useState('')
  const [attendeeCount, setAttendeeCount] = useState(0)

  // Linked
  const [joinCode, setJoinCode] = useState('')

  const [printers, setPrinters] = useState<Array<{ name: string; isDefault: boolean }>>([])
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [printerSkipped, setPrinterSkipped] = useState(false)

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
    // Do NOT prefill RegFox API key or event ID from persisted settings (Sprint 23.2).
  }, [])

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      if (!window.electronAPI?.initializeSettings) {
        setStep(returningUser ? 'connect' : 'welcome')
        return
      }

      await window.electronAPI.initializeSettings()
      await refreshStatus()
      setStep(returningUser ? 'connect' : 'welcome')
    }

    void bootstrap()
  }, [refreshStatus, returningUser])

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

  const continueAfterUnlock = useCallback(
    (path: UnlockPath): void => {
      setUnlockPath(path)
      onEventUnlocked?.()
      if (returningUser) {
        onComplete()
        return
      }
      setStep('printer')
    },
    [onComplete, onEventUnlocked, returningUser],
  )

  const handleLanguageContinue = async (): Promise<void> => {
    if (!window.electronAPI?.savePublicSettings) {
      return
    }

    await window.electronAPI.savePublicSettings({ language })
    setStep('connect')
  }

  const handlePrincipalUnlock = async (confirmTransfer = false): Promise<void> => {
    if (!window.electronAPI?.connectRegFox || !window.electronAPI?.claimFoxBridgeCloudPrincipal) {
      return
    }

    setError(null)

    const trimmedKey = apiKey.trim()
    const trimmedEventId = eventId.trim()
    if (!trimmedKey || !trimmedEventId) {
      setError(t('eventConnect.principalFieldsRequired'))
      return
    }

    setIsBusy(true)

    try {
      const connectResult = await window.electronAPI.connectRegFox({
        apiKey: trimmedKey,
        eventId: trimmedEventId,
      })
      if (!connectResult.success) {
        setNeedsTransferConfirmation(false)
        setError(connectResult.message ?? t('eventConnect.principalFailed'))
        return
      }

      setError(null)
      setAttendeeCount(connectResult.attendeeCount)

      const claimResult = await window.electronAPI.claimFoxBridgeCloudPrincipal({
        confirmTransfer,
        ownershipRegFoxApiKey: trimmedKey,
        ownershipRegFoxEventId: trimmedEventId,
      })

      if (claimResult.needsTransferConfirmation) {
        setNeedsTransferConfirmation(true)
        setError(null)
        return
      }

      if (!claimResult.success) {
        setNeedsTransferConfirmation(false)
        setError(claimResult.message ?? t('eventConnect.principalFailed'))
        // Remain locked — connectRegFox does not establish a session.
        return
      }

      setError(null)
      setNeedsTransferConfirmation(false)
      setApiKey('')
      await refreshStatus()
      continueAfterUnlock('principal')
    } catch (unlockError) {
      setNeedsTransferConfirmation(false)
      setError(
        unlockError instanceof Error ? unlockError.message : t('eventConnect.principalFailed'),
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleLinkedJoin = async (): Promise<void> => {
    if (!window.electronAPI?.redeemFoxBridgeLinkedJoin) {
      return
    }

    setError(null)

    const code = joinCode.trim()
    if (!code) {
      setError(t('eventConnect.joinCodeRequired'))
      return
    }

    setIsBusy(true)

    try {
      const result = await window.electronAPI.redeemFoxBridgeLinkedJoin({ joinCode: code })
      if (!result.success) {
        setError(result.message ?? t('eventConnect.joinFailed'))
        return
      }

      setError(null)
      setJoinCode('')
      await refreshStatus()
      continueAfterUnlock('linked')
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : t('eventConnect.joinFailed'))
    } finally {
      setIsBusy(false)
    }
  }

  const handlePrinterContinue = async (): Promise<void> => {
    if (selectedPrinter && window.electronAPI?.setPreferredPrinter) {
      await window.electronAPI.setPreferredPrinter(selectedPrinter)
    }

    setPrinterSkipped(!selectedPrinter)
    if (unlockPath === 'linked') {
      setStep('ready')
      return
    }
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

  const principalFieldsReady = Boolean(apiKey.trim() && eventId.trim())
  const conferenceLabel = settings?.conferenceName ?? setupStatus?.conferenceName ?? 'Conference'

  if (step === null) {
    return (
      <div className="setup-wizard">
        <div className="setup-wizard__card">
          <p className="setup-wizard__text" role="status">
            Loading…
          </p>
        </div>
      </div>
    )
  }

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

        {step === 'connect' && (
          <>
            <h1 className="setup-wizard__title">{t('eventConnect.title')}</h1>
            <p className="setup-wizard__text">{t('eventConnect.text')}</p>
            <div className="setup-wizard__choices setup-wizard__choices--stack">
              <button
                type="button"
                className="setup-wizard__choice setup-wizard__choice--block"
                onClick={() => {
                  setError(null)
                  setNeedsTransferConfirmation(false)
                  setApiKey('')
                  setEventId('')
                  setStep('setupMyEvent')
                }}
              >
                <strong>{t('sync.setupMyEvent')}</strong>
                <span className="setup-wizard__choice-help">{t('eventConnect.setupMyEventHelp')}</span>
              </button>
              <button
                type="button"
                className="setup-wizard__choice setup-wizard__choice--block"
                onClick={() => {
                  setError(null)
                  setJoinCode('')
                  setStep('joinExisting')
                }}
              >
                <strong>{t('sync.joinExisting')}</strong>
                <span className="setup-wizard__choice-help">{t('eventConnect.joinHelp')}</span>
              </button>
            </div>
            {!returningUser && (
              <div className="setup-wizard__actions">
                <button
                  type="button"
                  className="setup-wizard__button"
                  onClick={() => setStep('language')}
                >
                  {t('common.back')}
                </button>
              </div>
            )}
          </>
        )}

        {step === 'setupMyEvent' && (
          <>
            <h1 className="setup-wizard__title">{t('sync.setupMyEvent')}</h1>
            <p className="setup-wizard__text">{t('eventConnect.setupMyEventHelp')}</p>
            <label className="setup-wizard__field">
              <span>{t('regfox.apiKey')}</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <label className="setup-wizard__field">
              <span>{t('regfox.pageId')}</span>
              <input
                type="text"
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            {needsTransferConfirmation && (
              <div className="setup-wizard__transfer" role="status">
                <p className="setup-wizard__text">{t('sync.transfer.explain')}</p>
                <div className="setup-wizard__actions">
                  <button
                    type="button"
                    className="setup-wizard__button"
                    disabled={isBusy}
                    onClick={() => setNeedsTransferConfirmation(false)}
                  >
                    {t('sync.transfer.cancel')}
                  </button>
                  <button
                    type="button"
                    className="setup-wizard__button setup-wizard__button--primary"
                    disabled={isBusy || !principalFieldsReady}
                    onClick={() => {
                      setError(null)
                      void handlePrincipalUnlock(true)
                    }}
                  >
                    {isBusy ? '…' : t('sync.transfer.confirm')}
                  </button>
                </div>
              </div>
            )}
            {error && !isBusy && (
              <p className="setup-wizard__error" role="alert">
                {error}
              </p>
            )}
            {!needsTransferConfirmation && (
              <div className="setup-wizard__actions">
                <button
                  type="button"
                  className="setup-wizard__button"
                  onClick={() => {
                    setError(null)
                    setApiKey('')
                    setEventId('')
                    setStep('connect')
                  }}
                >
                  {t('common.back')}
                </button>
                <button
                  type="button"
                  className="setup-wizard__button setup-wizard__button--primary"
                  disabled={isBusy || !principalFieldsReady}
                  onClick={() => {
                    setError(null)
                    void handlePrincipalUnlock(false)
                  }}
                >
                  {isBusy ? '…' : t('regfox.connect')}
                </button>
              </div>
            )}
          </>
        )}

        {step === 'joinExisting' && (
          <>
            <h1 className="setup-wizard__title">{t('sync.joinExisting')}</h1>
            <p className="setup-wizard__text">{t('eventConnect.joinHelp')}</p>
            <label className="setup-wizard__field">
              <span>{t('sync.joinCodeLabel')}</span>
              <input
                type="text"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="XXXX-XXXX-XXXX"
              />
            </label>
            {error && !isBusy && (
              <p className="setup-wizard__error" role="alert">
                {error}
              </p>
            )}
            <div className="setup-wizard__actions">
              <button
                type="button"
                className="setup-wizard__button"
                onClick={() => {
                  setError(null)
                  setJoinCode('')
                  setStep('connect')
                }}
              >
                {t('common.back')}
              </button>
              <button
                type="button"
                className="setup-wizard__button setup-wizard__button--primary"
                disabled={isBusy || !joinCode.trim()}
                onClick={() => {
                  setError(null)
                  void handleLinkedJoin()
                }}
              >
                {isBusy ? '…' : t('sync.joinConnect')}
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
              <button type="button" className="setup-wizard__button" onClick={() => setStep('connect')}>
                {t('printer.back')}
              </button>
            </div>
          </>
        )}

        {step === 'mobile' && (
          <>
            <h1 className="setup-wizard__title">{t('mobile.title')}</h1>
            <p className="setup-wizard__text">{t('mobile.simpleText')}</p>
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
                {unlockPath === 'linked' ? t('ready.syncLinked') : t('ready.syncReady')}
              </li>
              <li>
                {setupStatus?.preferredPrinterName && setupStatus.printerAvailable
                  ? t('ready.printerReady')
                  : printerSkipped || !setupStatus?.preferredPrinterName
                    ? t('ready.printerUnavailable')
                    : t('ready.printerReady')}
              </li>
              {unlockPath !== 'linked' && (
                <li>
                  {setupStatus?.mobileConnected ? t('ready.mobileReady') : t('ready.mobileLater')}
                </li>
              )}
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
