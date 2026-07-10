import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PrimaryButton from '../components/PrimaryButton'
import QrScannerView from '../components/QrScannerView'
import { AttendeeLookupError } from '../models/attendee'
import {
  OrganizerTestError,
  activateOrganizerTestScanner,
} from '../services/organizerTestService'
import { PairingError, exchangePairingToken, extractPairingToken } from '../services/pairingService'
import {
  hasCompleteSession,
  loadVolunteerSession,
  saveVolunteerSession,
} from '../services/sessionStore'

const SPLASH_DURATION_MS = 900

type SplashMode = 'home' | 'scanning-pair'

export default function SplashScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isOrganizerTest = searchParams.get('organizer') === '1'
  const [isActivating, setIsActivating] = useState(false)
  const [mode, setMode] = useState<SplashMode>('home')
  const [error, setError] = useState<string | null>(null)
  const [isPairing, setIsPairing] = useState(false)

  useEffect(() => {
    if (isOrganizerTest) {
      return
    }

    let isMounted = true

    async function bootstrap(): Promise<void> {
      await new Promise((resolve) => {
        window.setTimeout(resolve, SPLASH_DURATION_MS)
      })

      if (!isMounted) {
        return
      }

      const session = loadVolunteerSession()
      if (hasCompleteSession(session)) {
        navigate('/ready', { replace: true })
        return
      }

      if (import.meta.env.DEV) {
        navigate('/sign-in', { replace: true })
      }
    }

    void bootstrap()

    return () => {
      isMounted = false
    }
  }, [isOrganizerTest, navigate])

  const completePairing = useCallback(
    async (token: string): Promise<void> => {
      setIsPairing(true)
      setError(null)

      try {
        const result = await exchangePairingToken(token)
        saveVolunteerSession({
          volunteerName: result.label || 'Volunteer',
          conferenceId: result.conferenceId,
          conferenceName: result.conferenceName,
          scannerSessionId: result.sessionId,
          stationLabel: result.label,
          signedInAt: new Date().toISOString(),
        })
        navigate('/ready', { replace: true })
      } catch (pairingError) {
        const session = loadVolunteerSession()
        if (hasCompleteSession(session)) {
          navigate('/ready', { replace: true })
          return
        }

        setMode('home')
        setError(
          pairingError instanceof PairingError
            ? pairingError.message
            : 'Unable to connect. Ask the organizer for a new pairing code.',
        )
      } finally {
        setIsPairing(false)
      }
    },
    [navigate],
  )

  const handlePairingScan = useCallback(
    (value: string): void => {
      const token = extractPairingToken(value)
      if (!token) {
        setMode('home')
        setError(
          'That code is not a FoxBridge pairing QR. Ask the organizer to show Connect a phone.',
        )
        return
      }

      void completePairing(token)
    },
    [completePairing],
  )

  const handleScannerError = useCallback((scanError: AttendeeLookupError): void => {
    setMode('home')
    setError(scanError.message)
  }, [])

  const handleStartScanner = async (): Promise<void> => {
    setIsActivating(true)
    setError(null)

    try {
      const result = await activateOrganizerTestScanner()

      saveVolunteerSession({
        volunteerName: 'Organizer test',
        conferenceId: result.conferenceId,
        conferenceName: result.conferenceName,
        scannerSessionId: result.sessionId,
        stationLabel: result.label,
        signedInAt: new Date().toISOString(),
      })

      navigate('/ready', { replace: true })
    } catch (activationError) {
      const message =
        activationError instanceof OrganizerTestError
          ? activationError.message
          : 'Unable to start the scanner right now. Try again in a moment.'
      setError(message)
    } finally {
      setIsActivating(false)
    }
  }

  const session = loadVolunteerSession()
  const waitingForPairing =
    !isOrganizerTest &&
    !import.meta.env.DEV &&
    !hasCompleteSession(session)

  if (isOrganizerTest) {
    return (
      <div className="splash-screen">
        <h1 className="splash-screen__title">FoxBridge</h1>
        <p className="splash-screen__subtitle">Organizer test entry</p>
        <p className="splash-screen__status">
          Start a temporary scanner session to test meal validation on this phone.
        </p>

        {error && (
          <p className="splash-screen__error" role="alert">
            {error}
          </p>
        )}

        <PrimaryButton
          className="splash-screen__action"
          onClick={() => void handleStartScanner()}
          disabled={isActivating}
        >
          {isActivating ? 'Starting…' : 'Start meal scanner'}
        </PrimaryButton>
      </div>
    )
  }

  if (mode === 'scanning-pair') {
    return (
      <div className="splash-screen splash-screen--scanning">
        <h1 className="splash-screen__title">FoxBridge</h1>
        <p className="splash-screen__subtitle">
          {isPairing ? 'Connecting to conference…' : 'Scan the organizer’s pairing QR'}
        </p>

        {error && (
          <p className="splash-screen__error" role="alert">
            {error}
          </p>
        )}

        {!isPairing && (
          <div className="splash-screen__scanner">
            <QrScannerView
              active
              onScan={handlePairingScan}
              onError={handleScannerError}
              hint="Line up the organizer’s pairing QR inside the frame."
            />
          </div>
        )}

        <PrimaryButton
          className="splash-screen__action"
          variant="secondary"
          onClick={() => {
            setMode('home')
            setError(null)
          }}
          disabled={isPairing}
        >
          Cancel
        </PrimaryButton>
      </div>
    )
  }

  return (
    <div className="splash-screen">
      <h1 className="splash-screen__title">FoxBridge</h1>
      <p className="splash-screen__subtitle">Meal validation for conference volunteers</p>
      <p className="splash-screen__status">
        {waitingForPairing
          ? 'Connect this phone with the organizer’s pairing QR, then scan attendee badges.'
          : 'Starting…'}
      </p>

      {error && (
        <p className="splash-screen__error" role="alert">
          {error}
        </p>
      )}

      {waitingForPairing && (
        <>
          <PrimaryButton
            className="splash-screen__action"
            onClick={() => {
              setError(null)
              setMode('scanning-pair')
            }}
          >
            Scan pairing code
          </PrimaryButton>
          <p className="splash-screen__hint">
            Or open the pairing link with your Camera app — FoxBridge will connect and open badge
            scanning.
          </p>
        </>
      )}
    </div>
  )
}
