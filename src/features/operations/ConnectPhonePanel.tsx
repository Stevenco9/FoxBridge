import { useCallback, useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import type { AppLanguage } from '../../shared/models/AppSettings'
import type { PairingInfo } from '../../shared/models/PairingInfo'
import { translate } from '../../i18n/messages'
import './ConnectPhonePanel.css'

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

export default function ConnectPhonePanel({
  language,
  open,
  onClose,
  refreshToken,
}: ConnectPhonePanelProps) {
  const [pairing, setPairing] = useState<PairingInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState('')

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
      setPairing(nextPairing)
    } catch {
      setPairing({
        ready: false,
        pairingUrl: null,
        expiresAt: null,
        tokenId: null,
        phoneConnected: false,
        error: 'Unable to create a pairing code right now. Try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setPairing(null)
      return
    }

    void createPairing()
  }, [open, createPairing, refreshToken])

  useEffect(() => {
    if (!open || !pairing?.expiresAt || pairing.phoneConnected) {
      return
    }

    const updateCountdown = (): void => {
      setCountdown(formatCountdown(pairing.expiresAt!))
    }

    updateCountdown()
    const intervalId = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(intervalId)
  }, [open, pairing?.expiresAt, pairing?.phoneConnected])

  useEffect(() => {
    if (!open || !pairing?.ready || !pairing.tokenId || pairing.phoneConnected) {
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
  }, [open, pairing?.ready, pairing?.tokenId, pairing?.phoneConnected])

  if (!open) {
    return null
  }

  const isExpired =
    pairing?.expiresAt && new Date(pairing.expiresAt).getTime() <= Date.now() && !pairing.phoneConnected

  return (
    <div className="connect-phone">
      <div className="connect-phone__backdrop" onClick={onClose} aria-hidden="true" />
      <section className="connect-phone__panel" role="dialog" aria-labelledby="connect-phone-title">
        <h2 id="connect-phone-title" className="connect-phone__title">
          {t('connect.title')}
        </h2>

        {isLoading && <p className="connect-phone__status">{t('connect.loading')}</p>}

        {!isLoading && pairing?.phoneConnected && (
          <p className="connect-phone__success" role="status">
            {t('connect.phoneConnected')}
          </p>
        )}

        {!isLoading && pairing && !pairing.ready && !pairing.phoneConnected && (
          <div className="connect-phone__notice">
            <p>{pairing.error ?? t('connect.unavailable')}</p>
          </div>
        )}

        {!isLoading && pairing?.ready && pairing.pairingUrl && !pairing.phoneConnected && (
          <>
            <p className="connect-phone__instruction">{t('connect.instruction')}</p>

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
              {isExpired
                ? t('connect.expired')
                : t('connect.expiresIn', { time: countdown || formatCountdown(pairing.expiresAt!) })}
            </p>
          </>
        )}

        {pairing?.error && pairing.ready && !pairing.phoneConnected && (
          <p className="connect-phone__error" role="alert">
            {pairing.error}
          </p>
        )}

        <div className="connect-phone__actions">
          {pairing?.ready && !pairing.phoneConnected && (
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
