import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileLayout from '../components/MobileLayout'
import PrimaryButton from '../components/PrimaryButton'
import type { ConferenceSummary } from '../models/session'
import { attachConferenceToSession } from '../services/authService'
import { getConferenceBySlug, listConferences } from '../services/conferenceService'
import { loadVolunteerSession } from '../services/sessionStore'

export default function ConferenceSelectionScreen() {
  const navigate = useNavigate()
  const [conferences, setConferences] = useState<ConferenceSummary[]>([])
  const [slug, setSlug] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadConferences(): Promise<void> {
      try {
        const rows = await listConferences()
        if (!isMounted) {
          return
        }

        setConferences(rows)
        setError(null)
      } catch (loadError) {
        if (!isMounted) {
          return
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load conferences from the cloud.'
        setError(message)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadConferences()

    return () => {
      isMounted = false
    }
  }, [])

  const selectConference = (conference: ConferenceSummary): void => {
    const currentSession = loadVolunteerSession()
    if (!currentSession) {
      navigate('/sign-in', { replace: true })
      return
    }

    attachConferenceToSession(currentSession, conference.id, conference.name)
    navigate('/ready', { replace: true })
  }

  const handleSlugSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const conference = await getConferenceBySlug(slug)
      if (!conference) {
        throw new Error('Conference code not found. Check spelling and try again.')
      }

      selectConference(conference)
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Unable to select conference.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <MobileLayout
      title="Choose conference"
      subtitle="Select the event you are serving today."
      footer={
        <PrimaryButton type="submit" form="conference-code-form" disabled={isSubmitting}>
          {isSubmitting ? 'Checking…' : 'Use conference code'}
        </PrimaryButton>
      }
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="form-field__hint">Loading conferences…</p>
      ) : conferences.length > 0 ? (
        <ul className="conference-list">
          {conferences.map((conference) => (
            <li key={conference.id}>
              <button
                type="button"
                className="conference-list__button"
                onClick={() => selectConference(conference)}
                disabled={isSubmitting}
              >
                {conference.name}
                {conference.slug && (
                  <span className="conference-list__slug">{conference.slug}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="form-field__hint">
          No conferences found in the cloud. Enter a conference code below.
        </p>
      )}

      <form id="conference-code-form" onSubmit={(event) => void handleSlugSubmit(event)}>
        <label className="form-field" htmlFor="conference-slug" style={{ marginTop: '1.25rem' }}>
          <span className="form-field__label">Conference code</span>
          <input
            id="conference-slug"
            className="form-field__input"
            type="text"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="e.g. adagra-2026"
            disabled={isSubmitting}
          />
        </label>
      </form>
    </MobileLayout>
  )
}
