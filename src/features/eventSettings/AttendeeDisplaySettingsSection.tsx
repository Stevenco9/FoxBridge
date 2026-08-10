import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Attendee } from '../../shared/models'
import {
  discoverAvailableAttendeeFields,
  type AvailableAttendeeField,
} from '../../shared/attendees/discoverAvailableAttendeeFields'
import {
  findFirstUnusedFieldKey,
  getSelectedKeysExcludingIndex,
  groupAvailableAttendeeFields,
  labelForFieldKey,
} from './attendeeDisplayCatalog'
import './AttendeeDisplaySettingsSection.css'

interface AttendeeDisplaySettingsSectionProps {
  eventId: string
  attendees: readonly Attendee[]
}

export default function AttendeeDisplaySettingsSection({
  eventId,
  attendees,
}: AttendeeDisplaySettingsSectionProps) {
  const [fieldKeys, setFieldKeys] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const catalog = useMemo(
    () => discoverAvailableAttendeeFields({ attendees }),
    [attendees],
  )

  const catalogByKey = useMemo(() => {
    const map = new Map<string, AvailableAttendeeField>()
    for (const field of catalog) {
      map.set(field.key, field)
    }
    return map
  }, [catalog])

  const groups = useMemo(() => groupAvailableAttendeeFields(catalog), [catalog])

  const loadSettings = useCallback(async (): Promise<void> => {
    if (!eventId.trim() || !window.electronAPI?.getEventSettings) {
      setFieldKeys([])
      setIsLoading(false)
      setError(
        eventId.trim()
          ? 'Event settings are only available in the desktop app.'
          : 'Connect RegFox with an event id before configuring Attendee Display.',
      )
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const settings = await window.electronAPI.getEventSettings(eventId)
      setFieldKeys(settings.attendeeDisplay.fieldKeys)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load attendee display settings.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (!statusMessage || isSaving) {
      return
    }

    const timer = window.setTimeout(() => {
      setStatusMessage(null)
    }, 1600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [statusMessage, isSaving])

  const persistKeys = useCallback(
    async (nextKeys: string[]): Promise<void> => {
      if (!eventId.trim() || !window.electronAPI?.patchEventSettings) {
        return
      }

      setIsSaving(true)
      setError(null)
      setStatusMessage(null)

      try {
        const saved = await window.electronAPI.patchEventSettings(eventId, {
          attendeeDisplay: { fieldKeys: nextKeys },
        })
        setFieldKeys(saved.attendeeDisplay.fieldKeys)
        setStatusMessage('Saved')
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Unable to save attendee display settings.',
        )
      } finally {
        setIsSaving(false)
      }
    },
    [eventId],
  )

  const handleChangeAt = (index: number, nextKey: string): void => {
    const taken = getSelectedKeysExcludingIndex(fieldKeys, index)
    if (nextKey.trim() && taken.has(nextKey.trim())) {
      return
    }

    const next = [...fieldKeys]
    next[index] = nextKey
    setFieldKeys(next)
    void persistKeys(next)
  }

  const handleRemoveAt = (index: number): void => {
    const next = fieldKeys.filter((_, rowIndex) => rowIndex !== index)
    setFieldKeys(next)
    void persistKeys(next)
  }

  const handleAdd = (): void => {
    const unused = findFirstUnusedFieldKey(catalog, fieldKeys)
    if (!unused) {
      return
    }

    const next = [...fieldKeys, unused]
    setFieldKeys(next)
    void persistKeys(next)
  }

  const canAdd = findFirstUnusedFieldKey(catalog, fieldKeys) != null

  return (
    <section className="attendee-display-settings" aria-labelledby="attendee-display-heading">
      <header className="attendee-display-settings__header">
        <div className="attendee-display-settings__title-block">
          <h3 id="attendee-display-heading" className="attendee-display-settings__title">
            Attendee Display
          </h3>
          <p className="attendee-display-settings__subtitle">
            Choose which registration fields appear on the attendee details screen. Items are shown
            in list order.
          </p>
        </div>
        {(isSaving || statusMessage) && (
          <p className="attendee-display-settings__status" role="status">
            {isSaving ? 'Saving…' : statusMessage}
          </p>
        )}
      </header>

      {isLoading && (
        <p className="attendee-display-settings__message" role="status">
          Loading display settings…
        </p>
      )}

      {error && (
        <p className="attendee-display-settings__message attendee-display-settings__message--error" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && (
        <>
          <ol className="attendee-display-settings__list">
            {fieldKeys.length === 0 && (
              <li className="attendee-display-settings__empty">
                No display items yet. Add a field to get started.
              </li>
            )}

            {fieldKeys.map((key, index) => {
              const taken = getSelectedKeysExcludingIndex(fieldKeys, index)
              const currentMissing = key.trim() !== '' && !catalogByKey.has(key.trim())
              const selectedLabel = labelForFieldKey(catalogByKey, key)

              return (
                <li key={`display-row-${index}`} className="attendee-display-settings__row">
                  <span className="attendee-display-settings__index" aria-hidden="true">
                    {index + 1}
                  </span>
                  <label className="attendee-display-settings__select-label">
                    <span className="visually-hidden">Display item {index + 1}</span>
                    <select
                      className={`attendee-display-settings__select${currentMissing ? ' attendee-display-settings__select--stale' : ''}`}
                      value={key}
                      title={selectedLabel}
                      onChange={(event) => handleChangeAt(index, event.target.value)}
                      disabled={isSaving}
                    >
                      {!key.trim() && (
                        <option value="">Select a field…</option>
                      )}
                      {currentMissing && (
                        <option value={key}>{selectedLabel}</option>
                      )}
                      {groups.map((group) => (
                        <optgroup key={group.id} label={group.label}>
                          {group.fields.map((field) => {
                            const disabled = taken.has(field.key)
                            return (
                              <option
                                key={field.key}
                                value={field.key}
                                disabled={disabled}
                                title={field.label}
                              >
                                {field.label}
                              </option>
                            )
                          })}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="attendee-display-settings__remove"
                    onClick={() => handleRemoveAt(index)}
                    disabled={isSaving}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ol>

          <button
            type="button"
            className="attendee-display-settings__add"
            onClick={handleAdd}
            disabled={isSaving || !canAdd}
          >
            Add display item
          </button>

          {!canAdd && catalog.length > 0 && fieldKeys.length > 0 && (
            <p className="attendee-display-settings__hint">
              Every available field is already in the list.
            </p>
          )}
        </>
      )}
    </section>
  )
}
