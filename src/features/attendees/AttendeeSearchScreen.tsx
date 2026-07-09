import { useEffect, useMemo, useState } from 'react'
import type { Attendee } from '../../shared/models'
import BadgePreviewPanel from '../badge/BadgePreview'
import { DEFAULT_BADGE_LAYOUT, type BadgeLayoutSelection } from '../badge/badgeFields'
import MealValidationPanel from '../meals/MealValidationPanel'
import { buildMealValidationKey } from '../meals/mealValidation'
import { getAttendeeFullName, searchAttendees } from './searchAttendees'
import './AttendeeSearchScreen.css'

export default function AttendeeSearchScreen() {
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [badgeLayout, setBadgeLayout] = useState<BadgeLayoutSelection>(DEFAULT_BADGE_LAYOUT)
  const [validatedMealKeys, setValidatedMealKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let isMounted = true

    async function loadAttendees(): Promise<void> {
      try {
        if (!window.electronAPI?.getAttendees) {
          throw new Error('Attendee loading is only available in the desktop app.')
        }

        const data = await window.electronAPI.getAttendees()
        if (!isMounted) {
          return
        }

        setAttendees(data)
        setError(null)
      } catch (loadError) {
        if (!isMounted) {
          return
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load attendees from RegFox.'
        setError(message)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadAttendees()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredAttendees = useMemo(
    () => searchAttendees(attendees, query),
    [attendees, query],
  )

  const selectedAttendee =
    filteredAttendees.find((attendee) => attendee.id === selectedId) ??
    attendees.find((attendee) => attendee.id === selectedId) ??
    null

  const handleValidateMeal = (attendeeId: string, mealPurchaseId: string): void => {
    setValidatedMealKeys((current) => {
      const next = new Set(current)
      next.add(buildMealValidationKey(attendeeId, mealPurchaseId))
      return next
    })
  }

  return (
    <div className="attendee-search">
      <header className="attendee-search__header">
        <div>
          <h1 className="attendee-search__title">FoxBridge</h1>
          <p className="attendee-search__subtitle">Find an attendee to check in</p>
        </div>
      </header>

      <div className="attendee-search__body">
        <section className="attendee-search__main">
          <label className="search-box" htmlFor="attendee-search-input">
            <span className="search-box__label">Search attendees</span>
            <input
              id="attendee-search-input"
              className="search-box__input"
              type="search"
              placeholder="Search by name, email, organization, purchase, or custom field"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={isLoading || Boolean(error)}
            />
          </label>

          {isLoading && (
            <div className="state-message" role="status">
              Loading attendees from RegFox...
            </div>
          )}

          {!isLoading && error && (
            <div className="state-message state-message--error" role="alert">
              {error}
            </div>
          )}

          {!isLoading && !error && (
            <>
              <p className="results-count">
                {filteredAttendees.length} attendee
                {filteredAttendees.length === 1 ? '' : 's'}
                {query.trim() ? ' found' : ''}
              </p>

              <ul className="attendee-list">
                {filteredAttendees.map((attendee) => {
                  const fullName = getAttendeeFullName(attendee)
                  const isSelected = attendee.id === selectedId

                  return (
                    <li key={attendee.id}>
                      <button
                        type="button"
                        className={`attendee-list__item${isSelected ? ' attendee-list__item--selected' : ''}`}
                        onClick={() => setSelectedId(attendee.id)}
                      >
                        <span className="attendee-list__name">
                          {fullName || 'Unnamed attendee'}
                        </span>
                        {attendee.email && (
                          <span className="attendee-list__meta">{attendee.email}</span>
                        )}
                        {attendee.organization && (
                          <span className="attendee-list__meta">
                            {attendee.organization}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>

              {filteredAttendees.length === 0 && (
                <div className="state-message">No attendees match your search.</div>
              )}
            </>
          )}
        </section>

        {!isLoading && !error && (
          <MealValidationPanel
            attendees={attendees}
            selectedAttendee={selectedAttendee}
            validatedMealKeys={validatedMealKeys}
            onValidateMeal={handleValidateMeal}
          />
        )}

        {selectedAttendee && (
          <BadgePreviewPanel
            attendee={selectedAttendee}
            layout={badgeLayout}
            onLayoutChange={setBadgeLayout}
          />
        )}
      </div>
    </div>
  )
}
