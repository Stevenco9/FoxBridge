import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppLanguage } from '../../shared/models/AppSettings'
import type { CloudStatus } from '../../shared/models/CloudStatus'
import {
  classifyFoxBridgeSyncIssue,
  formatLinkedConnectedUntil,
  foxBridgeSyncIssueFallbackMessage,
  normalizeDeskRoleLabel,
  resolveFoxBridgeSyncPhase,
  type FoxBridgeSyncUiPhase,
} from '../../shared/sync/foxbridgeSyncStatus'
import {
  formatUpstreamCheckInHealthMessage,
  resolveUpstreamCheckInHealthLevel,
  type UpstreamCheckInHealthCounts,
} from '../../shared/sync/upstreamCheckInHealth'
import { shouldOfferPrincipalUpgradeAction } from '../../shared/cloud/deskRolePolicy'
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
  deskRole: null,
  deskExpiresAt: null,
}

type PanelMode = 'none' | 'join' | 'principal_setup'

export interface FoxBridgeSyncEnrollmentProps {
  language: AppLanguage
  /** Wizard shows headings externally; panel/modal uses compact chrome. */
  variant: 'wizard' | 'panel'
  showSkip?: boolean
  onSkip?: () => void
  /** Called after a successful claim, join, or enroll (not when already connected on load). */
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
    case 'verification_failed':
      return t('sync.error.verificationFailed')
    case 'cloud_unavailable':
      return t('sync.error.cloudUnavailable')
    case 'needs_retry':
      return t('sync.error.needsRetry')
    case 'confirm_transfer':
      return t('sync.transfer.explain')
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
  const [panelMode, setPanelMode] = useState<PanelMode>('none')
  const [enrollmentCode, setEnrollmentCode] = useState('')
  const [deviceLabel, setDeviceLabel] = useState('')
  const [ownershipApiKey, setOwnershipApiKey] = useState('')
  const [ownershipEventId, setOwnershipEventId] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [needsTransferConfirmation, setNeedsTransferConfirmation] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [upstreamHealth, setUpstreamHealth] = useState<UpstreamCheckInHealthCounts | null>(
    null,
  )
  const onStatusResolvedRef = useRef(onStatusResolved)
  onStatusResolvedRef.current = onStatusResolved

  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
      translate(language, key, values),
    [language],
  )

  const refreshUpstreamHealth = useCallback(async (deskRole: string | null): Promise<void> => {
    if (deskRole !== 'principal' || !window.electronAPI?.getUpstreamCheckInHealth) {
      setUpstreamHealth(null)
      return
    }
    try {
      const health = await window.electronAPI.getUpstreamCheckInHealth()
      if (!health) {
        setUpstreamHealth(null)
        return
      }
      setUpstreamHealth({
        pending: health.pending,
        failedRetryable: health.failedRetryable,
        terminalOrExhausted: health.terminalOrExhausted,
        oldestWaitingAt: health.oldestWaitingAt,
      })
    } catch {
      setUpstreamHealth(null)
    }
  }, [])

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
      await refreshUpstreamHealth(next.deskRole)
      return next
    } catch {
      setStatus(EMPTY_STATUS)
      setUpstreamHealth(null)
      onStatusResolvedRef.current?.(false)
      return null
    } finally {
      setIsLoadingStatus(false)
    }
  }, [refreshUpstreamHealth])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus, refreshToken])

  const deskConnected = status.deskCredentialConfigured && status.connected
  const codeEntryVisible = panelMode === 'join'
  const ownershipFormVisible = panelMode === 'principal_setup'

  const phase = resolveFoxBridgeSyncPhase({
    isConnecting,
    codeEntryVisible: codeEntryVisible || ownershipFormVisible,
    needsTransferConfirmation,
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

  const connectedRoleLabel = normalizeDeskRoleLabel(status.deskRole)
  const linkedUntil = formatLinkedConnectedUntil(
    status.deskExpiresAt,
    language === 'es' ? 'es' : 'en',
  )

  const upstreamHealthLevel =
    connectedRoleLabel === 'principal' && upstreamHealth
      ? resolveUpstreamCheckInHealthLevel(upstreamHealth)
      : 'hidden'
  const upstreamHealthMessage =
    connectedRoleLabel === 'principal' && upstreamHealth
      ? formatUpstreamCheckInHealthMessage(upstreamHealthLevel, upstreamHealth, (key, values) =>
          t(key as Parameters<typeof translate>[1], values),
        )
      : null

  const clearOwnershipFields = (): void => {
    setOwnershipApiKey('')
    setOwnershipEventId('')
  }

  /**
   * Legacy-only silent claim (stored RegFox secrets). Linked / revoked / fresh
   * desks must use ownership credentials — never claim from Linked history alone.
   */
  const handleLegacyPrincipalUpgrade = async (confirmTransfer = false): Promise<void> => {
    if (!window.electronAPI?.claimFoxBridgeCloudPrincipal) {
      setEnrollError('unavailable')
      return
    }
    if (!shouldOfferPrincipalUpgradeAction(status.deskRole)) {
      setEnrollError('Connect RegFox with your API key and event ID to prove ownership.')
      setPanelMode('principal_setup')
      return
    }

    setIsConnecting(true)
    setEnrollError(null)

    try {
      const result = await window.electronAPI.claimFoxBridgeCloudPrincipal({
        confirmTransfer,
      })

      if (result.needsTransferConfirmation) {
        setNeedsTransferConfirmation(true)
        setEnrollError(null)
        return
      }

      if (!result.success) {
        setNeedsTransferConfirmation(false)
        setEnrollError(result.message ?? 'unavailable')
        return
      }

      setNeedsTransferConfirmation(false)
      setPanelMode('none')
      await refreshStatus()
      onEnrolled?.()
    } catch (error) {
      setNeedsTransferConfirmation(false)
      setEnrollError(error instanceof Error ? error.message : 'unavailable')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleOwnershipPrincipalClaim = async (confirmTransfer = false): Promise<void> => {
    if (!window.electronAPI?.claimFoxBridgeCloudPrincipal) {
      setEnrollError('unavailable')
      return
    }

    const apiKey = ownershipApiKey.trim()
    const eventId = ownershipEventId.trim()
    if (!apiKey || !eventId) {
      setEnrollError('Enter your RegFox API key and event ID to prove ownership.')
      return
    }

    setIsConnecting(true)
    setEnrollError(null)

    try {
      const result = await window.electronAPI.claimFoxBridgeCloudPrincipal({
        label: deviceLabel.trim() || null,
        confirmTransfer,
        ownershipRegFoxApiKey: apiKey,
        ownershipRegFoxEventId: eventId,
      })

      if (result.needsTransferConfirmation) {
        setNeedsTransferConfirmation(true)
        setEnrollError(null)
        return
      }

      if (!result.success) {
        setNeedsTransferConfirmation(false)
        setEnrollError(result.message ?? 'unavailable')
        return
      }

      setNeedsTransferConfirmation(false)
      clearOwnershipFields()
      setPanelMode('none')
      await refreshStatus()
      onEnrolled?.()
    } catch (error) {
      setNeedsTransferConfirmation(false)
      setEnrollError(error instanceof Error ? error.message : 'unavailable')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleTransferConfirm = async (): Promise<void> => {
    if (ownershipApiKey.trim() && ownershipEventId.trim()) {
      await handleOwnershipPrincipalClaim(true)
      return
    }
    if (shouldOfferPrincipalUpgradeAction(status.deskRole)) {
      await handleLegacyPrincipalUpgrade(true)
      return
    }
    setNeedsTransferConfirmation(false)
    setPanelMode('principal_setup')
    setEnrollError('Enter your RegFox API key and event ID to prove ownership.')
  }

  const handleJoinExisting = async (): Promise<void> => {
    if (!window.electronAPI?.redeemFoxBridgeLinkedJoin) {
      setEnrollError('unavailable')
      return
    }

    const code = enrollmentCode.trim()
    if (!code) {
      setEnrollError('invalid connection code')
      return
    }

    setIsConnecting(true)
    setEnrollError(null)

    try {
      const result = await window.electronAPI.redeemFoxBridgeLinkedJoin({
        joinCode: code,
        label: deviceLabel.trim() || null,
      })
      if (!result.success) {
        setEnrollError(result.message ?? 'invalid connection code')
        return
      }

      setEnrollmentCode('')
      setDeviceLabel('')
      setPanelMode('none')
      setNeedsTransferConfirmation(false)
      await refreshStatus()
      onEnrolled?.()
    } catch (error) {
      setEnrollError(error instanceof Error ? error.message : 'unavailable')
    } finally {
      setIsConnecting(false)
    }
  }

  const showJoinForm =
    panelMode === 'join' &&
    (phase === 'enter_code' ||
      phase === 'invalid_code' ||
      phase === 'expired_code' ||
      phase === 'needs_reenrollment' ||
      phase === 'revoked' ||
      phase === 'ready_to_setup' ||
      phase === 'not_connected' ||
      phase === 'verification_failed' ||
      phase === 'cloud_unavailable' ||
      phase === 'needs_retry')

  const showOwnershipForm =
    panelMode === 'principal_setup' &&
    !needsTransferConfirmation &&
    phase !== 'connecting' &&
    phase !== 'connected'

  const showReconnectPrompt =
    (phase === 'needs_reenrollment' || phase === 'revoked') && panelMode === 'none'

  const showSetupActions =
    (phase === 'ready_to_setup' ||
      phase === 'verification_failed' ||
      phase === 'cloud_unavailable' ||
      phase === 'needs_retry' ||
      phase === 'not_connected') &&
    panelMode === 'none' &&
    !isLoadingStatus

  const openPrincipalSetup = (): void => {
    setEnrollError(null)
    setNeedsTransferConfirmation(false)
    clearOwnershipFields()
    setPanelMode('principal_setup')
  }

  return (
    <div className={`foxbridge-sync foxbridge-sync--${variant}`}>
      {variant === 'panel' && (
        <>
          <h3 className="foxbridge-sync__title">{t('sync.title')}</h3>
          <p className="foxbridge-sync__text">{t('sync.text')}</p>
        </>
      )}

      {isLoadingStatus && phase !== 'connecting' && panelMode === 'none' && (
        <p className="foxbridge-sync__status" role="status">
          {t('sync.checking')}
        </p>
      )}

      {phase === 'connected' && !needsTransferConfirmation && (
        <div className="foxbridge-sync__success" role="status">
          <p>
            {connectedRoleLabel === 'principal'
              ? t('sync.connectedPrincipal')
              : connectedRoleLabel === 'linked'
                ? t('sync.connectedLinked')
                : connectedRoleLabel === 'legacy'
                  ? t('sync.connectedLegacy')
                  : t('sync.connectedCheck')}
          </p>
          {connectedRoleLabel === 'linked' && linkedUntil && (
            <p className="foxbridge-sync__until">
              {t('sync.connectedUntil', { when: linkedUntil })}
            </p>
          )}
          {connectedRoleLabel === 'principal' && upstreamHealthMessage && (
            <p
              className={
                upstreamHealthLevel === 'attention'
                  ? 'foxbridge-sync__upstream foxbridge-sync__upstream--attention'
                  : upstreamHealthLevel === 'soft_pending'
                    ? 'foxbridge-sync__upstream foxbridge-sync__upstream--pending'
                    : 'foxbridge-sync__upstream'
              }
            >
              {upstreamHealthMessage}
            </p>
          )}
        </div>
      )}

      {phase === 'connected' &&
        !needsTransferConfirmation &&
        shouldOfferPrincipalUpgradeAction(status.deskRole) && (
          <div className="foxbridge-sync__upgrade">
            <p className="foxbridge-sync__text">{t('sync.upgrade.explain')}</p>
            {enrollError && (
              <p className="foxbridge-sync__error" role="alert">
                {(() => {
                  const issue = classifyFoxBridgeSyncIssue(enrollError)
                  if (issue === 'verification_failed') {
                    return t('sync.error.verificationFailed')
                  }
                  if (issue === 'cloud_unavailable') {
                    return t('sync.error.cloudUnavailable')
                  }
                  return (
                    foxBridgeSyncIssueFallbackMessage(issue) ||
                    t('sync.error.needsRetry')
                  )
                })()}
              </p>
            )}
            <button
              type="button"
              className="foxbridge-sync__button foxbridge-sync__button--primary"
              onClick={() => void handleLegacyPrincipalUpgrade(false)}
              disabled={isConnecting}
            >
              {isConnecting ? t('sync.connecting') : t('sync.upgrade.action')}
            </button>
          </div>
        )}

      {(phase === 'confirm_transfer' || needsTransferConfirmation) && (
        <div className="foxbridge-sync__transfer">
          <p className="foxbridge-sync__text">{t('sync.transfer.explain')}</p>
          <p className="foxbridge-sync__warning">{t('sync.transfer.warning')}</p>
          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--primary"
            onClick={() => void handleTransferConfirm()}
            disabled={isConnecting}
          >
            {isConnecting ? t('sync.connecting') : t('sync.transfer.confirm')}
          </button>
          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--quiet"
            onClick={() => {
              setNeedsTransferConfirmation(false)
              setEnrollError(null)
              if (!shouldOfferPrincipalUpgradeAction(status.deskRole)) {
                setPanelMode('principal_setup')
              }
            }}
            disabled={isConnecting}
          >
            {t('sync.transfer.cancel')}
          </button>
        </div>
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
            onClick={() => {
              setEnrollError(null)
              setPanelMode('join')
            }}
          >
            {t('sync.joinExisting')}
          </button>
          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--quiet"
            onClick={openPrincipalSetup}
          >
            {t('sync.setupMyEvent')}
          </button>
        </div>
      )}

      {showSetupActions && (
        <div className="foxbridge-sync__setup">
          {(phase === 'verification_failed' ||
            phase === 'cloud_unavailable' ||
            phase === 'needs_retry') &&
            statusMessage && (
              <p className="foxbridge-sync__error" role="alert">
                {statusMessage}
              </p>
            )}
          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--primary"
            onClick={() => {
              setEnrollError(null)
              setNeedsTransferConfirmation(false)
              setPanelMode('join')
            }}
            disabled={isConnecting}
          >
            {t('sync.joinExisting')}
          </button>
          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--quiet"
            onClick={openPrincipalSetup}
            disabled={isConnecting}
          >
            {phase === 'verification_failed' ||
            phase === 'cloud_unavailable' ||
            phase === 'needs_retry'
              ? t('sync.retry')
              : t('sync.setupMyEvent')}
          </button>
        </div>
      )}

      {phase === 'connecting' && panelMode === 'none' && (
        <p className="foxbridge-sync__status" role="status">
          {t('sync.connecting')}
        </p>
      )}

      {showJoinForm && !needsTransferConfirmation && (
        <div className="foxbridge-sync__form">
          <p className="foxbridge-sync__text">{t('sync.joinHelp')}</p>
          <label className="foxbridge-sync__field">
            <span>{t('sync.joinCodeLabel')}</span>
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
          <label className="foxbridge-sync__field">
            <span>{t('sync.deviceNameLabel')}</span>
            <input
              type="text"
              value={deviceLabel}
              onChange={(event) => setDeviceLabel(event.target.value)}
              placeholder={t('sync.deviceNamePlaceholder')}
              autoComplete="off"
              disabled={isConnecting}
            />
          </label>

          {((enrollError && panelMode === 'join') ||
            (statusMessage && phase !== 'enter_code' && phase !== 'ready_to_setup')) && (
            <p className="foxbridge-sync__error" role="alert">
              {enrollError
                ? (() => {
                    const issue = classifyFoxBridgeSyncIssue(enrollError)
                    if (issue === 'invalid_code') {
                      return t('sync.error.invalidCode')
                    }
                    if (issue === 'expired_code') {
                      return t('sync.error.expiredCode')
                    }
                    if (issue === 'cloud_unavailable') {
                      return t('sync.error.cloudUnavailable')
                    }
                    if (issue === 'verification_failed') {
                      return t('sync.error.verificationFailed')
                    }
                    return (
                      foxBridgeSyncIssueFallbackMessage(issue) ||
                      t('sync.error.needsRetry')
                    )
                  })()
                : statusMessage}
            </p>
          )}

          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--primary"
            onClick={() => void handleJoinExisting()}
            disabled={isConnecting || !enrollmentCode.trim()}
          >
            {isConnecting ? t('sync.connecting') : t('sync.joinConnect')}
          </button>
          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--quiet"
            onClick={() => {
              setPanelMode('none')
              setEnrollmentCode('')
              setDeviceLabel('')
              setEnrollError(null)
            }}
            disabled={isConnecting}
          >
            {t('sync.backToSetup')}
          </button>
        </div>
      )}

      {showOwnershipForm && (
        <div className="foxbridge-sync__form">
          <p className="foxbridge-sync__text">{t('sync.ownershipHelp')}</p>
          <label className="foxbridge-sync__field">
            <span>{t('sync.ownershipApiKey')}</span>
            <input
              type="password"
              value={ownershipApiKey}
              onChange={(event) => {
                setOwnershipApiKey(event.target.value)
                setEnrollError(null)
              }}
              autoComplete="off"
              disabled={isConnecting}
            />
          </label>
          <label className="foxbridge-sync__field">
            <span>{t('sync.ownershipEventId')}</span>
            <input
              type="text"
              value={ownershipEventId}
              onChange={(event) => {
                setOwnershipEventId(event.target.value)
                setEnrollError(null)
              }}
              autoComplete="off"
              disabled={isConnecting}
            />
          </label>
          <label className="foxbridge-sync__field">
            <span>{t('sync.deviceNameLabel')}</span>
            <input
              type="text"
              value={deviceLabel}
              onChange={(event) => setDeviceLabel(event.target.value)}
              placeholder={t('sync.deviceNamePlaceholder')}
              autoComplete="off"
              disabled={isConnecting}
            />
          </label>

          {enrollError && (
            <p className="foxbridge-sync__error" role="alert">
              {(() => {
                const issue = classifyFoxBridgeSyncIssue(enrollError)
                if (issue === 'verification_failed') {
                  return t('sync.error.verificationFailed')
                }
                if (issue === 'cloud_unavailable') {
                  return t('sync.error.cloudUnavailable')
                }
                return foxBridgeSyncIssueFallbackMessage(issue) || enrollError
              })()}
            </p>
          )}

          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--primary"
            onClick={() => void handleOwnershipPrincipalClaim(false)}
            disabled={isConnecting || !ownershipApiKey.trim() || !ownershipEventId.trim()}
          >
            {isConnecting ? t('sync.connecting') : t('sync.setupMyEvent')}
          </button>
          <button
            type="button"
            className="foxbridge-sync__button foxbridge-sync__button--quiet"
            onClick={() => {
              setPanelMode('none')
              clearOwnershipFields()
              setDeviceLabel('')
              setEnrollError(null)
            }}
            disabled={isConnecting}
          >
            {t('sync.backToSetup')}
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
