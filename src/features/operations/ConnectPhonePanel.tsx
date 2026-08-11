import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import type { AppLanguage } from '../../shared/models/AppSettings'
import type { PairingInfo } from '../../shared/models/PairingInfo'
import { translate } from '../../i18n/messages'
import './ConnectPhonePanel.css'

type PairingPhase = 'generating' | 'waiting' | 'connected' | 'expired' | 'failed'

interface ConnectPhonePanelProps {
  language: AppLanguage
  open: boolean
  onClose: () => void
  refreshToken?: number | string
}

function formatCountdown(expiresAt: string): string {
  const remainingMs = new Date(expiresAt).getTime() - Date.now()
  if (remainingMs <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function resolvePhase(
  isLoading: boolean,
  pairing: PairingInfo | null,
  isExpired: boolean,
): PairingPhase {
  if (isLoading) {
    return 'generating'
  }
  if (pairing?.phoneConnected) {
    return 'connected'
  }
  if (isExpired) {
    return 'expired'
  }
  if (pairing?.ready && pairing.pairingUrl) {
    return 'waiting'
  }
  return 'failed'
}

export default function ConnectPhonePanel({
  language,
  open,
  onClose,
  refreshToken,
}: ConnectPhonePanelProps) {
  const [pairing, setPairing] = useState<PairingInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState('')
  const autoRenewingRef = useRef(false)

  const t = useCallback(
    (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
      translate(language, key, values),
    [language],
  )

  const createPairing = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.createScannerPairing) {
      return
    }

    setIsLoading(true)

    try {
      const nextPairing = await window.electronAPI.createScannerPairing()
      setPairing({
        ...nextPairing,
        warning: nextPairing.warning ?? null,
      })
    } catch {
      setPairing({
        ready: false,
        pairingUrl: null,
        expiresAt: null,
        tokenId: null,
        phoneConnected: false,
        error: 'Unable to create a phone code right now. Try again.',
        warning: null,
      })
    } finally {
      setIsLoading(false)
      autoRenewingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setPairing(null)
      autoRenewingRef.current = false
      return
    }

    void createPairing()
  }, [open, createPairing, refreshToken])

  const isExpired = Boolean(
    pairing?.expiresAt &&
      new Date(pairing.expiresAt).getTime() <= Date.now() &&
      !pairing.phoneConnected &&
      pairing.ready,
  )

  const phase = resolvePhase(isLoading, pairing, isExpired)

  useEffect(() => {
    if (!open || !pairing?.expiresAt || pairing.phoneConnected || phase === 'failed') {
      return
    }

    const updateCountdown = (): void => {
      setCountdown(formatCountdown(pairing.expiresAt!))
    }

    updateCountdown()
    const intervalId = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(intervalId)
  }, [open, pairing?.expiresAt, pairing?.phoneConnected, phase])

  useEffect(() => {
    if (!open || !pairing?.ready || !pairing.tokenId || pairing.phoneConnected || isExpired) {
      return
    }

    const pollStatus = async (): Promise<void> => {
      if (!window.electronAPI?.getPairingStatus || !pairing.tokenId) {
        return
      }

      const status = await window.electronAPI.getPairingStatus(pairing.tokenId)
      if (status.used) {
        setPairing((current) =>
          current ? { ...current, phoneConnected: true, error: null } : current,
        )
      }
    }

    const intervalId = window.setInterval(() => {
      void pollStatus()
    }, 2000)

    return () => window.clearInterval(intervalId)
  }, [open, pairing?.ready, pairing?.tokenId, pairing?.phoneConnected, isExpired])

  // Auto-create a fresh code when the current one expires (one-shot).
  useEffect(() => {
    if (!open || !isExpired || isLoading || autoRenewingRef.current) {
      return
    }

    autoRenewingRef.current = true
    void createPairing()
  }, [open, isExpired, isLoading, createPairing])

  if (!open) {
    return null
  }

  return (
    <div className="connect-phone">
      <div className="connect-phone__backdrop" onClick={onClose} aria-hidden="true" />
      <section className="connect-phone__panel" role="dialog" aria-labelledby="connect-phone-title">
        <h2 id="connect-phone-title" className="connect-phone__title">
          {t('connect.title')}
        </h2>

        {phase === 'generating' && (
          <p className="connect-phone__status" role="status">
            {t('connect.loading')}
          </p>
        )}

        {phase === 'connected' && (
          <p className="connect-phone__success" role="status">
            {t('connect.phoneConnected')}
          </p>
        )}

        {phase === 'failed' && (
          <div className="connect-phone__notice">
            <p>{pairing?.error ?? t('connect.unavailable')}</p>
          </div>
        )}

        {phase === 'waiting' && pairing?.pairingUrl && (
          <>
            <p className="connect-phone__instruction">{t('connect.instruction')}</p>
            <p className="connect-phone__waiting" role="status">
              {t('connect.waiting')}
            </p>

            <div className="connect-phone__qr-wrap">
              <QRCode
                value={pairing.pairingUrl}
                size={260}
                bgColor="#ffffff"
                fgColor="#111827"
                level="M"
              />
            </div>

            <p className="connect-phone__countdown">
              {t('connect.expiresIn', {
                time: countdown || formatCountdown(pairing.expiresAt!),
              })}
            </p>

            {pairing.warning && (
              <p className="connect-phone__warning" role="status">
                {pairing.warning}
              </p>
            )}
          </>
        )}

        {phase === 'expired' && (
          <p className="connect-phone__status" role="status">
            {t('connect.renewing')}
          </p>
        )}

        <div className="connect-phone__actions">
          {(phase === 'waiting' || phase === 'failed' || phase === 'expired') && (
            <button
              type="button"
              className="connect-phone__button connect-phone__button--primary"
              onClick={() => void createPairing()}
              disabled={isLoading}
            >
              {t('connect.newCode')}
            </button>
          )}
          <button
            type="button"
            className="connect-phone__button connect-phone__button--primary connect-phone__close"
            onClick={onClose}
          >
            {t('connect.close')}
          </button>
        </div>
      </section>
    </div>
  )
}
