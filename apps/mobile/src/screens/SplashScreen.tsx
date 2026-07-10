import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkSupabaseConnection, isSupabaseConfigured } from '../lib/supabaseClient'
import { loadVolunteerSession } from '../services/sessionStore'

const SPLASH_DURATION_MS = 1400

export default function SplashScreen() {
  const navigate = useNavigate()
  const [statusMessage, setStatusMessage] = useState('Starting…')

  useEffect(() => {
    let isMounted = true

    async function bootstrap(): Promise<void> {
      if (!isSupabaseConfigured()) {
        if (isMounted) {
          setStatusMessage('Supabase not configured — dev sign-in may still work')
        }
      } else {
        const connected = await checkSupabaseConnection()
        if (isMounted) {
          setStatusMessage(connected ? 'Connected to cloud' : 'Cloud unavailable — check network')
        }
      }

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

      if (session?.volunteerName) {
        navigate('/conference', { replace: true })
        return
      }

      navigate('/sign-in', { replace: true })
    }

    void bootstrap()

    return () => {
      isMounted = false
    }
  }, [navigate])

  return (
    <div className="splash-screen">
      <h1 className="splash-screen__title">FoxBridge</h1>
      <p className="splash-screen__subtitle">Meal validation for conference volunteers</p>
      <p className="splash-screen__status">{statusMessage}</p>
    </div>
  )
}
