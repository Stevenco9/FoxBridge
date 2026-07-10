import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileLayout from '../components/MobileLayout'
import PrimaryButton from '../components/PrimaryButton'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { signInVolunteer } from '../services/authService'

export default function SignInScreen() {
  const navigate = useNavigate()
  const [volunteerName, setVolunteerName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await signInVolunteer(volunteerName, accessCode)
      navigate(result.skipConferenceSelection ? '/ready' : '/conference', { replace: true })
    } catch (signInError) {
      const message =
        signInError instanceof Error ? signInError.message : 'Unable to sign in. Try again.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <MobileLayout
      title="Sign in"
      subtitle="Enter your name and the scanner code from registration staff."
      footer={
        <PrimaryButton type="submit" form="sign-in-form" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Continue'}
        </PrimaryButton>
      }
    >
      <form id="sign-in-form" onSubmit={(event) => void handleSubmit(event)}>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <label className="form-field" htmlFor="volunteer-name">
          <span className="form-field__label">Your name</span>
          <input
            id="volunteer-name"
            className="form-field__input"
            type="text"
            autoComplete="name"
            value={volunteerName}
            onChange={(event) => setVolunteerName(event.target.value)}
            placeholder="e.g. Alex"
            disabled={isSubmitting}
          />
        </label>

        <label className="form-field" htmlFor="scanner-code">
          <span className="form-field__label">Scanner code</span>
          <input
            id="scanner-code"
            className="form-field__input"
            type="text"
            autoComplete="one-time-code"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            placeholder="Code from registration desk"
            disabled={isSubmitting}
          />
          <p className="form-field__hint">
            {isSupabaseConfigured()
              ? 'Use the station code printed or shared by FoxBridge desktop staff.'
              : 'Supabase is not configured. Use the dev access code from apps/mobile/.env.'}
          </p>
        </label>
      </form>
    </MobileLayout>
  )
}
