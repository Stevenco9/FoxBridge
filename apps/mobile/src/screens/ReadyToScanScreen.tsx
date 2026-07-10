import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import AttendeeLookupResultView from '../components/AttendeeLookupResultView'
import MobileLayout from '../components/MobileLayout'
import PrimaryButton from '../components/PrimaryButton'
import QrScannerView from '../components/QrScannerView'
import {
  AttendeeLookupError,
  type AttendeeLookupResult,
  normalizeQrInput,
} from '../models/attendee'
import { lookupAttendeeByQrIdentifier } from '../services/attendeeService'
import { clearVolunteerSession, hasCompleteSession, loadVolunteerSession } from '../services/sessionStore'

type ScannerMode = 'home' | 'scanning' | 'manual' | 'loading' | 'result'

export default function ReadyToScanScreen() {
  const navigate = useNavigate()
  const session = useMemo(() => loadVolunteerSession(), [])
  const [mode, setMode] = useState<ScannerMode>('home')
  const [manualCode, setManualCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [attendee, setAttendee] = useState<AttendeeLookupResult | null>(null)

  useEffect(() => {
    if (!hasCompleteSession(session)) {
      navigate('/sign-in', { replace: true })
    }
  }, [navigate, session])

  const resetToHome = useCallback((): void => {
    setMode('home')
    setManualCode('')
    setError(null)
    setAttendee(null)
  }, [])

  const performLookup = useCallback(
    async (rawValue: string): Promise<void> => {
      if (!session) {
        return
      }

      setMode('loading')
      setError(null)
      setAttendee(null)

      try {
        const result = await lookupAttendeeByQrIdentifier(session.conferenceId, rawValue)
        setAttendee(result)
        setMode('result')
      } catch (lookupError) {
        const message =
          lookupError instanceof AttendeeLookupError
            ? lookupError.message
            : 'Unable to look up that badge. Try again.'
        setError(message)
        setMode('home')
      }
    },
    [session],
  )

  const handleScan = useCallback(
    (value: string): void => {
      void performLookup(value)
    },
    [performLookup],
  )

  const handleScannerError = useCallback((scannerError: AttendeeLookupError): void => {
    setError(scannerError.message)
    setMode('home')
  }, [])

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    void performLookup(manualCode)
  }

  const handleSignOut = (): void => {
    clearVolunteerSession()
    navigate('/sign-in', { replace: true })
  }

  if (!hasCompleteSession(session)) {
    return null
  }

  const title =
    mode === 'result'
      ? 'Attendee found'
      : mode === 'manual'
        ? 'Enter badge code'
        : mode === 'scanning'
          ? 'Scan badge'
          : 'Ready to scan'

  const subtitle =
    mode === 'result'
      ? 'Confirm this is the person at the meal line.'
      : mode === 'manual'
        ? 'Type the code from the badge if the camera is not working.'
        : mode === 'scanning'
          ? 'Hold the printed badge QR code steady in the frame.'
          : 'Scan a badge QR code or enter the code manually.'

  const footer = (() => {
    if (mode === 'loading') {
      return (
        <PrimaryButton disabled aria-busy="true">
          Looking up attendee…
        </PrimaryButton>
      )
    }

    if (mode === 'scanning') {
      return (
        <PrimaryButton variant="secondary" onClick={resetToHome}>
          Cancel scan
        </PrimaryButton>
      )
    }

    if (mode === 'manual') {
      return (
        <div className="scanner-actions">
          <PrimaryButton type="submit" form="manual-code-form">
            Look up attendee
          </PrimaryButton>
          <PrimaryButton variant="secondary" onClick={resetToHome}>
            Back
          </PrimaryButton>
        </div>
      )
    }

    if (mode === 'result') {
      return (
        <div className="scanner-actions">
          <PrimaryButton onClick={resetToHome}>Scan another badge</PrimaryButton>
          <PrimaryButton variant="secondary" onClick={handleSignOut}>
            Sign out
          </PrimaryButton>
        </div>
      )
    }

    return (
      <div className="scanner-actions">
        <PrimaryButton onClick={() => setMode('scanning')}>Scan badge</PrimaryButton>
        <PrimaryButton variant="secondary" onClick={() => setMode('manual')}>
          Enter code manually
        </PrimaryButton>
        <PrimaryButton variant="secondary" onClick={handleSignOut}>
          Sign out
        </PrimaryButton>
      </div>
    )
  })()

  return (
    <MobileLayout title={title} subtitle={subtitle} footer={footer}>
      {mode !== 'result' && mode !== 'scanning' && (
        <>
          <div className="status-card" style={{ marginBottom: '1rem' }}>
            <p className="status-card__label">Volunteer</p>
            <p className="status-card__value">{session.volunteerName}</p>
          </div>

          <div className="status-card" style={{ marginBottom: '1rem' }}>
            <p className="status-card__label">Conference</p>
            <p className="status-card__value">{session.conferenceName}</p>
          </div>
        </>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {mode === 'home' && (
        <div className="scanner-home-card">
          <p className="scanner-home-card__title">Scanner ready</p>
          <p className="scanner-home-card__text">
            Use the camera to scan a printed badge, or enter the QR value manually.
          </p>
        </div>
      )}

      {mode === 'scanning' && (
        <QrScannerView active onScan={handleScan} onError={handleScannerError} />
      )}

      {mode === 'manual' && (
        <form id="manual-code-form" onSubmit={handleManualSubmit}>
          <label className="form-field" htmlFor="manual-badge-code">
            <span className="form-field__label">Badge code</span>
            <input
              id="manual-badge-code"
              className="form-field__input"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoFocus
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Paste or type QR value"
            />
            <p className="form-field__hint">
              {normalizeQrInput(manualCode)
                ? 'This should match the value encoded in the badge QR.'
                : 'Find this on the badge or from desktop staff.'}
            </p>
          </label>
        </form>
      )}

      {mode === 'loading' && (
        <div className="scanner-home-card" role="status">
          <p className="scanner-home-card__title">Looking up attendee…</p>
          <p className="scanner-home-card__text">Checking Supabase for this conference.</p>
        </div>
      )}

      {mode === 'result' && attendee && <AttendeeLookupResultView attendee={attendee} />}
    </MobileLayout>
  )
}
