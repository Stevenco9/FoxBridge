import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadVolunteerSession } from '../services/sessionStore'

const SPLASH_DURATION_MS = 900

export default function SplashScreen() {
  const navigate = useNavigate()

  useEffect(() => {
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
  }, [navigate])

  const session = loadVolunteerSession()
  const waitingForPairing =
    !import.meta.env.DEV &&
    !(session?.volunteerName && session.conferenceId && session.conferenceName)

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
