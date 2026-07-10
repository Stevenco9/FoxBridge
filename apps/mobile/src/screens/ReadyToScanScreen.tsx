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
import {
  buildMealDisplayModel,
  MealValidationError,
  type MealRowState,
} from '../models/mealValidation'
import { lookupAttendeeByQrIdentifier } from '../services/attendeeService'
import { validateMeal } from '../services/mealValidationService'
import { hasCompleteSession, loadVolunteerSession } from '../services/sessionStore'

type ScannerMode = 'home' | 'scanning' | 'manual' | 'loading' | 'result'

export default function ReadyToScanScreen() {
  const navigate = useNavigate()
  const session = useMemo(() => loadVolunteerSession(), [])
  const [mode, setMode] = useState<ScannerMode>('home')
  const [manualCode, setManualCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [attendee, setAttendee] = useState<AttendeeLookupResult | null>(null)
  const [mealStates, setMealStates] = useState<MealRowState[]>([])

  useEffect(() => {
    if (!hasCompleteSession(session)) {
      navigate('/', { replace: true })
    }
  }, [navigate, session])

  const resetToHome = useCallback((): void => {
    setMode('home')
    setManualCode('')
    setError(null)
    setAttendee(null)
    setMealStates([])
  }, [])

  const performLookup = useCallback(
    async (rawValue: string): Promise<void> => {
      if (!session) {
        return
      }

      setMode('loading')
      setError(null)
      setAttendee(null)
      setMealStates([])

      try {
        const result = await lookupAttendeeByQrIdentifier(session.conferenceId, rawValue)
        setAttendee(result)
        // Single deterministic display pipeline — do not re-sort afterward.
        setMealStates(
          buildMealDisplayModel(result.mealEntitlements, result.existingValidations),
        )
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

  const handleValidateMeal = useCallback(
    async (mealKey: string, mealLabel: string): Promise<void> => {
      if (!session || !attendee) {
        return
      }

      setMealStates((current) =>
        current.map((meal) =>
          meal.mealKey === mealKey
            ? { ...meal, status: 'validating', errorMessage: null }
            : meal,
        ),
      )

      try {
        const result = await validateMeal({
          conferenceId: session.conferenceId,
          attendeeId: attendee.qrIdentifier,
          mealKey,
          mealLabel,
          scannerSessionId: session.scannerSessionId,
        })

        setMealStates((current) =>
          current.map((meal) =>
            meal.mealKey === mealKey
              ? {
                  ...meal,
                  status: result.status === 'created' ? 'validated' : 'already_validated',
                  validatedAt: result.validatedAt,
                  errorMessage: null,
                }
              : meal,
          ),
        )
      } catch (validationError) {
        const message =
          validationError instanceof MealValidationError
            ? validationError.message
            : 'Unable to validate this meal. Try again.'

        setMealStates((current) =>
          current.map((meal) =>
            meal.mealKey === mealKey
              ? { ...meal, status: 'error', errorMessage: message }
              : meal,
          ),
        )
      }
    },
    [attendee, session],
  )

  const handleScannerError = useCallback((scannerError: AttendeeLookupError): void => {
    setError(scannerError.message)
    setMode('home')
  }, [])

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    void performLookup(manualCode)
  }

  if (!hasCompleteSession(session)) {
    return null
  }

  const title =
    mode === 'result'
      ? attendee?.displayName || 'Attendee found'
      : mode === 'manual'
        ? 'Enter badge code'
        : mode === 'scanning'
          ? 'Scan attendee badge'
          : 'Scan attendee badge'

  const subtitle =
    mode === 'result'
      ? session.conferenceName
      : mode === 'manual'
        ? 'Type the code from the badge if the camera is not working.'
        : mode === 'scanning'
          ? 'Hold the printed badge QR code steady in the frame.'
          : session.conferenceName

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
        <PrimaryButton onClick={resetToHome}>Scan next attendee</PrimaryButton>
      )
    }

    return (
      <div className="scanner-actions">
        <PrimaryButton onClick={() => setMode('scanning')}>Scan attendee badge</PrimaryButton>
        <PrimaryButton variant="secondary" onClick={() => setMode('manual')}>
          Enter code manually
        </PrimaryButton>
      </div>
    )
  })()

  return (
    <MobileLayout title={title} subtitle={subtitle} footer={footer}>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {mode === 'home' && (
        <div className="scanner-home-card">
          <p className="scanner-home-card__title">{session.conferenceName}</p>
          <p className="scanner-home-card__text">
            Scan a badge QR code or enter the code manually.
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
                : 'Find this on the badge or ask desktop staff.'}
            </p>
          </label>
        </form>
      )}

      {mode === 'loading' && (
        <div className="scanner-home-card" role="status">
          <p className="scanner-home-card__title">Looking up attendee…</p>
          <p className="scanner-home-card__text">Checking registration for this conference.</p>
        </div>
      )}

      {mode === 'result' && attendee && (
        <AttendeeLookupResultView
          attendee={attendee}
          mealStates={mealStates}
          onValidateMeal={(mealKey, mealLabel) => void handleValidateMeal(mealKey, mealLabel)}
        />
      )}
    </MobileLayout>
  )
}
