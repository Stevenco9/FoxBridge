import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MobileLayout from '../components/MobileLayout'
import PrimaryButton from '../components/PrimaryButton'
import { PairingError, exchangePairingToken } from '../services/pairingService'
import { saveVolunteerSession } from '../services/sessionStore'

type PairState = 'connecting' | 'connected' | 'error'

export default function PairScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<PairState>('connecting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setState('error')
      setErrorMessage('This pairing link is missing a code.')
      return
    }

    let isMounted = true

    async function pair(): Promise<void> {
      try {
        const result = await exchangePairingToken(token!)
        if (!isMounted) {
          return
        }

        saveVolunteerSession({
          volunteerName: result.label || 'Volunteer',
          conferenceId: result.conferenceId,
          conferenceName: result.conferenceName,
          scannerSessionId: result.sessionId,
          stationLabel: result.label,
          signedInAt: new Date().toISOString(),
        })

        setState('connected')
        window.setTimeout(() => {
          navigate('/ready', { replace: true })
        }, 900)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setState('error')
        setErrorMessage(
          error instanceof PairingError
            ? error.message
            : 'Unable to connect to the conference. Ask the organizer for a new code.',
        )
      }
    }

    void pair()

    return () => {
      isMounted = false
    }
  }, [navigate, searchParams])

  const title =
    state === 'connected'
      ? 'Phone connected'
      : state === 'error'
        ? 'Could not connect'
        : 'Connecting to conference…'

  const subtitle =
    state === 'connected'
      ? 'Opening the scanner…'
      : state === 'error'
        ? errorMessage ?? 'This pairing code did not work.'
        : 'Please wait while this phone joins the conference.'

  return (
    <MobileLayout
      title={title}
      subtitle={subtitle}
      footer={
        state === 'error' ? (
          <PrimaryButton variant="secondary" onClick={() => navigate('/', { replace: true })}>
            Close
          </PrimaryButton>
        ) : undefined
      }
    >
      {state === 'connecting' && (
        <div className="scanner-home-card" role="status" aria-live="polite">
          <p className="scanner-home-card__title">Connecting…</p>
          <p className="scanner-home-card__text">This usually takes just a moment.</p>
        </div>
      )}

      {state === 'connected' && (
        <div className="scanner-home-card" role="status" aria-live="polite">
          <p className="scanner-home-card__title">Phone connected</p>
          <p className="scanner-home-card__text">Ready to scan attendee badges.</p>
        </div>
      )}

      {state === 'error' && errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}
    </MobileLayout>
  )
}
