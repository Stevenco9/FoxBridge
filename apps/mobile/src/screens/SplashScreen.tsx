import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PrimaryButton from '../components/PrimaryButton'
import {
  OrganizerTestError,
  activateOrganizerTestScanner,
} from '../services/organizerTestService'
import { loadVolunteerSession, saveVolunteerSession } from '../services/sessionStore'

const SPLASH_DURATION_MS = 900

export default function SplashScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isOrganizerTest = searchParams.get('organizer') === '1'
  const [isActivating, setIsActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      if (session?.volunteerName && session.conferenceId && session.conferenceName) {
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
    !(session?.volunteerName && session.conferenceId && session.conferenceName)

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

  return (
    <div className="splash-screen">
      <h1 className="splash-screen__title">FoxBridge</h1>
      <p className="splash-screen__subtitle">Meal validation for conference volunteers</p>
      <p className="splash-screen__status">
        {waitingForPairing
          ? 'Scan the organizer’s pairing code with your Camera app.'
          : 'Starting…'}
      </p>
    </div>
  )
}
