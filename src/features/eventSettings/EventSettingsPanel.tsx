import { useEffect, useState } from 'react'
import type { Attendee } from '../../shared/models'
import AttendeeDisplaySettingsSection from './AttendeeDisplaySettingsSection'
import './EventSettingsPanel.css'

interface EventSettingsPanelProps {
  open: boolean
  attendees: readonly Attendee[]
  onClose: () => void
}

/**
 * Organizer Event Settings shell. Attendee Display is the first section;
 * future badge / meal / workshop prefs can share this panel.
 */
export default function EventSettingsPanel({
  open,
  attendees,
  onClose,
}: EventSettingsPanelProps) {
  const [eventId, setEventId] = useState<string | null>(null)
  const [conferenceName, setConferenceName] = useState<string | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    const loadMeta = async (): Promise<void> => {
      if (!window.electronAPI?.getPublicSettings) {
        setMetaError('Event settings are only available in the desktop app.')
        return
      }

      try {
        const settings = await window.electronAPI.getPublicSettings()
        if (cancelled) {
          return
        }
        setEventId(settings.regfoxEventId)
        setConferenceName(settings.conferenceName)
        setMetaError(null)
      } catch (error) {
        if (!cancelled) {
          setMetaError(
            error instanceof Error ? error.message : 'Unable to load event settings.',
          )
        }
      }
    }

    void loadMeta()

    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) {
    return null
  }

  const subtitle = conferenceName?.trim()
    ? conferenceName
    : eventId
      ? `Event ${eventId}`
      : 'No event connected'

  return (
    <div className="event-settings" role="dialog" aria-modal="true" aria-labelledby="event-settings-title">
      <button
        type="button"
        className="event-settings__backdrop"
        aria-label="Close event settings"
        onClick={onClose}
      />
      <div className="event-settings__panel">
        <header className="event-settings__header">
          <div className="event-settings__title-block">
            <h2 id="event-settings-title" className="event-settings__title">
              Event Settings
            </h2>
            <p className="event-settings__subtitle">{subtitle}</p>
          </div>
          <button type="button" className="event-settings__close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="event-settings__body">
          {metaError && (
            <p className="event-settings__error" role="alert">
              {metaError}
            </p>
          )}

          {!metaError && eventId && (
            <div className="event-settings__sections">
              <AttendeeDisplaySettingsSection eventId={eventId} attendees={attendees} />
            </div>
          )}

          {!metaError && !eventId && (
            <p className="event-settings__error" role="status">
              Connect to a RegFox event before configuring event settings.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
