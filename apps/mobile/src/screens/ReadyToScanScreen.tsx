import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileLayout from '../components/MobileLayout'
import PrimaryButton from '../components/PrimaryButton'
import { clearVolunteerSession, hasCompleteSession, loadVolunteerSession } from '../services/sessionStore'

export default function ReadyToScanScreen() {
  const navigate = useNavigate()
  const session = useMemo(() => loadVolunteerSession(), [])

  useEffect(() => {
    if (!hasCompleteSession(session)) {
      navigate('/sign-in', { replace: true })
    }
  }, [navigate, session])

  if (!hasCompleteSession(session)) {
    return null
  }

  const handleSignOut = (): void => {
    clearVolunteerSession()
    navigate('/sign-in', { replace: true })
  }

  return (
    <MobileLayout
      title="Ready to scan"
      subtitle="Hold a badge QR code up to the camera when scanning is enabled."
      footer={
        <PrimaryButton variant="secondary" onClick={handleSignOut}>
          Sign out
        </PrimaryButton>
      }
    >
      <div className="status-card" style={{ marginBottom: '1rem' }}>
        <p className="status-card__label">Volunteer</p>
        <p className="status-card__value">{session.volunteerName}</p>
      </div>

      <div className="status-card" style={{ marginBottom: '1rem' }}>
        <p className="status-card__label">Conference</p>
        <p className="status-card__value">{session.conferenceName}</p>
      </div>

      {session.stationLabel && (
        <div className="status-card" style={{ marginBottom: '1rem' }}>
          <p className="status-card__label">Station</p>
          <p className="status-card__value">{session.stationLabel}</p>
        </div>
      )}

      <div className="scan-placeholder" aria-label="Scanner coming soon">
        <p className="scan-placeholder__title">Scanner coming soon</p>
        <p className="scan-placeholder__text">
          QR scanning and meal validation will appear here in a future sprint.
        </p>
      </div>
    </MobileLayout>
  )
}
