import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppLanguage } from '../../shared/models/AppSettings'
import type { CloudStatus } from '../../shared/models/CloudStatus'
import {
  classifyFoxBridgeSyncIssue,
  foxBridgeSyncIssueFallbackMessage,
  resolveFoxBridgeSyncPhase,
  type FoxBridgeSyncUiPhase,
} from '../../shared/sync/foxbridgeSyncStatus'
import { translate } from '../../i18n/messages'
import './FoxBridgeSyncEnrollment.css'

const EMPTY_STATUS: CloudStatus = {
  configured: false,
  connected: false,
  conferenceId: null,
  conferenceName: null,
  lastPublishAt: null,
  lastPublishAttendeeCount: null,
  lastPublishError: null,
  deskCredentialConfigured: false,
  connectionError: null,
}

export interface FoxBridgeSyncEnrollmentProps {
  language: AppLanguage
  /** Wizard shows headings externally; panel/modal uses compact chrome. */
  variant: 'wizard' | 'panel'
  showSkip?: boolean
  onSkip?: () => void
  /** Called after a successful enroll (not when already connected on load). */
  onEnrolled?: () => void
  /** Fires whenever status is refreshed (including initial load). */
  onStatusResolved?: (connected: boolean) => void
  refreshToken?: number | string
}

function phaseStatusMessage(
  phase: FoxBridgeSyncUiPhase,
  t: (key: Parameters<typeof translate>[1]) => string,
  enrollError: string | null,
  connectionError: string | null,
): string | null {
  switch (phase) {
    case 'connecting':
      return t('sync.connecting')
    case 'connected':
      return t('sync.connected')
    case 'invalid_code':
    case 'expired_code':
    case 'revoked':
    case 'needs_reenrollment': {
      const issue = classifyFoxBridgeSyncIssue(enrollError ?? connectionError)
      const fallback = foxBridgeSyncIssueFallbackMessage(issue)
      if (phase === 'invalid_code') {
        return t('sync.error.invalidCode')
      }
      if (phase === 'expired_code') {
        return t('sync.error.expiredCode')
      }
      if (phase === 'revoked') {
        return t('sync.error.revoked')
      }
      if (phase === 'needs_reenrollment') {
        return t('sync.error.needsReconnect')
      }
      return fallback || t('sync.error.unavailable')
    }
    default:
      return null
  }
}

export default function FoxBridgeSyncEnrollment({
  language,
  variant,
  showSkip = false,
  onSkip,
  onEnrolled,
  onStatusResolved,
  refreshToken,
}: FoxBridgeSyncEnrollmentProps) {
  const [status, setStatus] = useState<CloudStatus>(EMPTY_STATUS)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [codeEntryVisible, setCodeEntryVisible] = useState(false)
  const [enrollmentCode, setEnrollmentCode] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const onStatusResolvedRef = useRef(onStatusResolved)
  onStatusResolvedRef.current = onStatusResolved

  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
      translate(language, key, values),
    [language],
  )

  const refreshStatus = useCallback(async (): Promise<CloudStatus | null> => {
    if (!window.electronAPI?.getCloudStatus) {
      setIsLoadingStatus(false)
      onStatusResolvedRef.current?.(false)
      return null
    }

    setIsLoadingStatus(true)
    try {
      const next = await window.electronAPI.getCloudStatus()
      setStatus(next)
      onStatusResolvedRef.current?.(Boolean(next.deskCredentialConfigured && next.connected))
      return next
    } catch {
      setStatus(EMPTY_STATUS)
      onStatusResolvedRef.current?.(false)
      return null
    } finally {
      setIsLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus, refreshToken])

  const deskConnected = status.deskCredentialConfigured && status.connected

  const phase = resolveFoxBridgeSyncPhase({
    isConnecting,
    codeEntryVisible: codeEntryVisible || (!deskConnected && !isLoadingStatus),
    deskCredentialConfigured: status.deskCredentialConfigured,
    connected: deskConnected,
    connectionError: status.connectionError,
    enrollError,
  })

  const statusMessage = phaseStatusMessage(
    phase,
    t,
    enrollError,
    status.connectionError,
  )

  const handleConnect = async (): Promise<void> => {
    if (!window.electronAPI?.enrollFoxBridgeCloudDesktop) {
      setEnrollError('unavailable')
      return
    }

    const code = enrollmentCode.trim()
    if (!code) {
      setEnrollError('invalid enrollment code')
      return
    }

    setIsConnecting(true)
    setEnrollError(null)

    try {
      const result = await window.electronAPI.enrollFoxBridgeCloudDesktop({
        enrollmentCode: code,
      })
      if (!result.success) {
        setEnrollError(result.message ?? 'invalid enrollment code')
        return
      }

      setEnrollmentCode('')
      setCodeEntryVisible(false)
      await refreshStatus()
      onEnrolled?.()
    } catch (error) {
      setEnrollError(error instanceof Error ? error.message : 'unavailable')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleStartReconnect = (): void => {
    setEnrollError(null)
    setCodeEntryVisible(true)
  }

  const showCodeForm =
    phase === 'enter_code' ||
    phase === 'connecting' ||
    phase === 'invalid_code' ||
    phase === 'expired_code' ||
    (phase === 'needs_reenrollment' && codeEntryVisible) ||
    (phase === 'revoked' && codeEntryVisible) ||
    (phase === 'not_connected' && codeEntryVisible)

  const showReconnectPrompt =
    (phase === 'needs_reenrollment' || phase === 'revoked') && !codeEntryVisible

  return (
    <div className={`foxbridge-sync foxbridge-sync--${variant}`}>
      {variant === 'panel' && (
        <>
          <h3 className="foxbridge-sync__title">{t('sync.title')}</h3>
          <p className="foxbridge-sync__text">{t('sync.text')}</p>
        </>
      )}

      {isLoadingStatus && phase !== 'connecting' && (
        <p className="foxbridge-sync__status" role="status">
          {t('sync.checking')}
        </p>
      )}

      {phase === 'connected' && (
        <p className="foxbridge-sync__success" role="status">
          {t('sync.connectedCheck')}
        </p>
      )}

      {showReconnectPrompt && (
        <div className="foxbridge-sync__reconnect">
          {statusMessage && (
            <p className="foxbridge-sync__error" role="alert">
              {statusMessage}
            </p>
          )}
          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--primary"
            onClick={handleStartReconnect}
          >
            {t('sync.reconnect')}
          </button>
        </div>
      )}

      {phase === 'not_connected' && !showCodeForm && (
        <button
          type="button"
          className="foxbridge-sync__button foxbridge-sync__button--primary"
          onClick={() => {
            setEnrollError(null)
            setCodeEntryVisible(true)
          }}
        >
          {t('sync.connect')}
        </button>
      )}

      {showCodeForm && (
        <div className="foxbridge-sync__form">
          {variant === 'wizard' && (
            <p className="foxbridge-sync__text">{t('sync.enterCodeHelp')}</p>
          )}
          <label className="foxbridge-sync__field">
            <span>{t('sync.codeLabel')}</span>
            <input
              type="text"
              value={enrollmentCode}
              onChange={(event) => {
                setEnrollmentCode(event.target.value)
                setEnrollError(null)
              }}
              placeholder={t('sync.codePlaceholder')}
              autoComplete="off"
              disabled={isConnecting}
            />
          </label>

          {statusMessage && phase !== 'enter_code' && phase !== 'not_connected' && (
            <p
              className={
                phase === 'connecting'
                  ? 'foxbridge-sync__status'
                  : 'foxbridge-sync__error'
              }
              role={phase === 'connecting' ? 'status' : 'alert'}
            >
              {statusMessage}
            </p>
          )}

          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--primary"
            onClick={() => void handleConnect()}
            disabled={isConnecting || !enrollmentCode.trim()}
          >
            {isConnecting ? t('sync.connecting') : t('sync.connect')}
          </button>
        </div>
      )}

      {showSkip && onSkip && phase !== 'connected' && phase !== 'connecting' && (
        <button type="button" className="foxbridge-sync__button foxbridge-sync__button--quiet" onClick={onSkip}>
          {t('sync.setupLater')}
        </button>
      )}
    </div>
  )
}
