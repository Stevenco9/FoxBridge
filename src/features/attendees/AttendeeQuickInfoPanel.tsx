import { useEffect, useMemo, useState } from 'react'
import type { Attendee } from '../../shared/models'
import { discoverAvailableAttendeeFields } from '../../shared/attendees/discoverAvailableAttendeeFields'
import { resolveAttendeeDisplayItems } from '../../shared/attendees/resolveAttendeeDisplayValue'
import './AttendeeQuickInfoPanel.css'

interface AttendeeQuickInfoPanelProps {
  attendee: Attendee
  /** Used to build the discovery catalog (labels + event-specific fields). */
  attendees: readonly Attendee[]
  /** Bump when Event Settings close so fieldKeys reload. */
  refreshToken?: number | string
}

export default function AttendeeQuickInfoPanel({
  attendee,
  attendees,
  refreshToken,
}: AttendeeQuickInfoPanelProps) {
  const [fieldKeys, setFieldKeys] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      if (!window.electronAPI?.getPublicSettings || !window.electronAPI?.getEventSettings) {
        if (!cancelled) {
          setFieldKeys([])
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)

      try {
        const settings = await window.electronAPI.getPublicSettings()
        const eventId = settings.regfoxEventId?.trim()
        if (!eventId) {
          if (!cancelled) {
            setFieldKeys([])
          }
          return
        }

        const eventSettings = await window.electronAPI.getEventSettings(eventId)
        if (!cancelled) {
          setFieldKeys(eventSettings.attendeeDisplay.fieldKeys)
        }
      } catch {
        if (!cancelled) {
          setFieldKeys([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [refreshToken])

  const catalogByKey = useMemo(() => {
    const catalog = discoverAvailableAttendeeFields({ attendees })
    return new Map(catalog.map((field) => [field.key, field]))
  }, [attendees])

  const items = useMemo(
    () => resolveAttendeeDisplayItems(attendee, fieldKeys, catalogByKey),
    [attendee, fieldKeys, catalogByKey],
  )

  if (isLoading || items.length === 0) {
    return null
  }

  return (
    <aside className="quick-info-panel" aria-label="Attendee display">
      <h2 className="quick-info-panel__title">Quick Info</h2>
      <dl className="quick-info-panel__details">
        {items.map((item) => (
          <div key={item.key} className="quick-info-panel__row">
            <dt className="quick-info-panel__label" title={item.label}>
              {item.label}
            </dt>
            <dd className="quick-info-panel__value">
              {item.lines.map((line, index) => (
                <span
                  key={`${item.key}-${index}`}
                  className="quick-info-panel__line"
                  title={line}
                >
                  {line}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
