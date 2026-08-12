import { useCallback, useEffect, useState } from 'react'
import type { AppLanguage } from '../../shared/models/AppSettings'
import { canManageLinkedDesks } from '../../shared/cloud/deskRolePolicy'
import { formatJoinCodeRemaining } from '../../shared/cloud/deskCredentialPolicy'
import { formatLinkedConnectedUntil } from '../../shared/sync/foxbridgeSyncStatus'
import { translate } from '../../i18n/messages'
import './ConnectedDesktopsPanel.css'

interface ConnectedDeskRow {
  id: string
  label: string | null
  role: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
  isCurrent: boolean
}

interface ConnectedDesktopsPanelProps {
  language: AppLanguage
  open: boolean
  onClose: () => void
  refreshToken?: number | string
}

function deskStateLabel(
  desk: ConnectedDeskRow,
  t: (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) => string,
  language: AppLanguage,
): string {
  if (desk.revokedAt) {
    return t('desks.state.revoked')
  }
  if (desk.expiresAt && new Date(desk.expiresAt).getTime() <= Date.now()) {
    return t('desks.state.expired')
  }
  if (desk.role === 'linked' && desk.expiresAt) {
    const when = formatLinkedConnectedUntil(desk.expiresAt, language === 'es' ? 'es' : 'en')
    return when ? t('desks.state.until', { when }) : t('desks.state.active')
  }
  return t('desks.state.active')
}

export default function ConnectedDesktopsPanel({
  language,
  open,
  onClose,
  refreshToken,
}: ConnectedDesktopsPanelProps) {
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [desks, setDesks] = useState<ConnectedDeskRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [issuedCode, setIssuedCode] = useState<string | null>(null)
  const [issuedExpiresAt, setIssuedExpiresAt] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [issuing, setIssuing] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
      translate(language, key, values),
    [language],
  )

  const refresh = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.getCloudStatus || !window.electronAPI?.listFoxBridgeConnectedDesks) {
      setAllowed(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const status = await window.electronAPI.getCloudStatus()
      const role = status.deskRole
      const canManage =
        status.connected &&
        role !== null &&
        canManageLinkedDesks(role === 'principal' || role === 'linked' || role === 'legacy' ? role : 'legacy')

      setAllowed(canManage)
      if (!canManage) {
        setDesks([])
        return
      }

      const result = await window.electronAPI.listFoxBridgeConnectedDesks()
      setDesks(result.desks)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('desks.error.load'))
      setDesks([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!open) {
      return
    }
    setIssuedCode(null)
    setIssuedExpiresAt(null)
    void refresh()
  }, [open, refresh, refreshToken])

  useEffect(() => {
    if (!issuedExpiresAt) {
      return
    }
    setNowMs(Date.now())
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [issuedExpiresAt])

  if (!open) {
    return null
  }

  const handleIssue = async (): Promise<void> => {
    if (!window.electronAPI?.issueFoxBridgeJoinCode) {
      return
    }
    setIssuing(true)
    setError(null)
    try {
      const result = await window.electronAPI.issueFoxBridgeJoinCode({ ttlMinutes: 15 })
      setIssuedCode(result.joinCode)
      setIssuedExpiresAt(result.expiresAt)
      setNowMs(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('desks.error.issue'))
    } finally {
      setIssuing(false)
    }
  }

  const handleRevoke = async (deskDeviceId: string): Promise<void> => {
    if (!window.electronAPI?.revokeFoxBridgeLinkedDesktop) {
      return
    }
    setRevokingId(deskDeviceId)
    setError(null)
    try {
      await window.electronAPI.revokeFoxBridgeLinkedDesktop({ deskDeviceId })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('desks.error.revoke'))
    } finally {
      setRevokingId(null)
    }
  }

  const countdown = issuedExpiresAt
    ? formatJoinCodeRemaining(issuedExpiresAt, nowMs)
    : null
  const codeExpired = Boolean(countdown?.expired)

  return (
    <div className="connected-desks" role="dialog" aria-modal="true" aria-labelledby="connected-desks-title">
      <button
        type="button"
        className="connected-desks__backdrop"
        aria-label={translate(language, 'connect.close')}
        onClick={onClose}
      />
      <section className="connected-desks__panel">
        <h2 id="connected-desks-title" className="connected-desks__title">
          {t('desks.title')}
        </h2>
        <p className="connected-desks__text">{t('desks.text')}</p>

        {loading && (
          <p className="connected-desks__status" role="status">
            {t('desks.loading')}
          </p>
        )}

        {!loading && !allowed && (
          <p className="connected-desks__error" role="alert">
            {t('desks.principalOnly')}
          </p>
        )}

        {!loading && allowed && (
          <>
            <ul className="connected-desks__list">
              {desks.map((desk) => {
                const roleLabel =
                  desk.role === 'principal'
                    ? t('desks.role.principal')
                    : desk.role === 'linked'
                      ? t('desks.role.linked')
                      : t('desks.role.legacy')
                const canRevoke =
                  desk.role === 'linked' && !desk.revokedAt && !desk.isCurrent

                return (
                  <li key={desk.id} className="connected-desks__item">
                    <div>
                      <p className="connected-desks__name">
                        {desk.label?.trim() || t('desks.unnamed')}
                        {desk.isCurrent ? ` (${t('desks.thisComputer')})` : ''}
                      </p>
                      <p className="connected-desks__meta">
                        {roleLabel} · {deskStateLabel(desk, t, language)}
                      </p>
                    </div>
                    {canRevoke && (
                      <button
                        type="button"
                        className="connected-desks__revoke"
                        onClick={() => void handleRevoke(desk.id)}
                        disabled={revokingId === desk.id}
                      >
                        {revokingId === desk.id ? t('desks.revoking') : t('desks.revoke')}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="connected-desks__invite">
              <h3 className="connected-desks__subtitle">{t('desks.inviteTitle')}</h3>
              {issuedCode && issuedExpiresAt && !codeExpired ? (
                <div className="connected-desks__code-box">
                  <p className="connected-desks__code">{issuedCode}</p>
                  <p className="connected-desks__countdown" role="timer" aria-live="polite">
                    {t('desks.codeExpiresIn', { time: countdown!.mmss })}
                  </p>
                  <p className="connected-desks__instruction">{t('desks.codeInstruction')}</p>
                </div>
              ) : null}

              {issuedCode && codeExpired ? (
                <div className="connected-desks__code-box connected-desks__code-box--expired">
                  <p className="connected-desks__expired" role="status">
                    {t('desks.codeExpired')}
                  </p>
                  <button
                    type="button"
                    className="connected-desks__button"
                    onClick={() => void handleIssue()}
                    disabled={issuing}
                  >
                    {issuing ? t('desks.issuing') : t('desks.generateCode')}
                  </button>
                </div>
              ) : null}

              {!issuedCode ? (
                <button
                  type="button"
                  className="connected-desks__button"
                  onClick={() => void handleIssue()}
                  disabled={issuing}
                >
                  {issuing ? t('desks.issuing') : t('desks.generateCode')}
                </button>
              ) : null}
            </div>
          </>
        )}

        {error && (
          <p className="connected-desks__error" role="alert">
            {error}
          </p>
        )}

        <button type="button" className="connected-desks__close" onClick={onClose}>
          {translate(language, 'connect.close')}
        </button>
      </section>
    </div>
  )
}
