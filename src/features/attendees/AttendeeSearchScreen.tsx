import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Attendee } from '../../shared/models'
import type { AppLanguage, SetupStatus } from '../../shared/models/AppSettings'
import BadgePreviewPanel from '../badge/BadgePreview'
import { DEFAULT_BADGE_LAYOUT, type BadgeLayoutSelection } from '../badge/badgeFields'
import ConnectPhonePanel from '../operations/ConnectPhonePanel'
import OperationsHome from '../operations/OperationsHome'
import MealValidationPanel from '../meals/MealValidationPanel'
import SettingsModal from '../settings/SettingsModal'
import { getAttendeeFullName, searchAttendees } from './searchAttendees'
import './AttendeeSearchScreen.css'

interface AttendeeSearchScreenProps {
  onReopenSetup: () => void
}

export default function AttendeeSearchScreen({ onReopenSetup }: AttendeeSearchScreenProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [badgeLayout, setBadgeLayout] = useState<BadgeLayoutSelection>(DEFAULT_BADGE_LAYOUT)
  const [language, setLanguage] = useState<AppLanguage>('en')
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectPhoneOpen, setConnectPhoneOpen] = useState(false)
  const [connectRefreshToken, setConnectRefreshToken] = useState(0)
  const [showDesktopMealValidation, setShowDesktopMealValidation] = useState(false)

  const searchRef = useRef<HTMLElement | null>(null)
  const badgeRef = useRef<HTMLElement | null>(null)

  const loadAttendees = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      if (!window.electronAPI?.getAttendees) {
        throw new Error('Attendee loading is only available in the desktop app.')
      }

      const data = await window.electronAPI.getAttendees()
      setAttendees(data)
      setError(null)
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load attendees from RegFox.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshMeta = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) {
      return
    }

    const [settings, status] = await Promise.all([
      window.electronAPI.getPublicSettings(),
      window.electronAPI.getSetupStatus(),
    ])
    setLanguage(settings.language)
    setSetupStatus(status)
    setShowDesktopMealValidation(settings.showDesktopMealValidation)
  }, [])

  useEffect(() => {
    void loadAttendees()
    void refreshMeta()
  }, [loadAttendees, refreshMeta])

  const filteredAttendees = useMemo(
    () => searchAttendees(attendees, query),
    [attendees, query],
  )

  const selectedAttendee =
    filteredAttendees.find((attendee) => attendee.id === selectedId) ??
    attendees.find((attendee) => attendee.id === selectedId) ??
    null

  const handleReopenSetup = async (): Promise<void> => {
    if (window.electronAPI?.resetSetup) {
      await window.electronAPI.resetSetup()
    }
    setSettingsOpen(false)
    onReopenSetup()
  }

  const handleLanguageChange = async (nextLanguage: AppLanguage): Promise<void> => {
    if (!window.electronAPI?.savePublicSettings) {
      return
    }

    await window.electronAPI.savePublicSettings({ language: nextLanguage })
    setLanguage(nextLanguage)
  }

  return (
    <div className="attendee-search">
      <header className="attendee-search__header">
        <div>
          <h1 className="attendee-search__title">FoxBridge</h1>
          <p className="attendee-search__subtitle">Registration check-in and badge printing</p>
        </div>
      </header>

      <OperationsHome
        language={language}
        refreshToken={attendees.length}
        onConnectPhone={() => setConnectPhoneOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="attendee-search__body">
        <section className="attendee-search__main" ref={searchRef}>
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

        {!isLoading && !error && showDesktopMealValidation && (
          <section>
            <MealValidationPanel
              attendees={attendees}
              selectedAttendee={selectedAttendee}
            />
          </section>
        )}

        {selectedAttendee && (
          <section ref={badgeRef}>
            <BadgePreviewPanel
              attendee={selectedAttendee}
              layout={badgeLayout}
              onLayoutChange={setBadgeLayout}
            />
          </section>
        )}
      </div>

      <ConnectPhonePanel
        language={language}
        open={connectPhoneOpen}
        refreshToken={connectRefreshToken}
        onClose={() => setConnectPhoneOpen(false)}
      />

      <SettingsModal
        language={language}
        setupStatus={setupStatus}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onReopenSetup={() => void handleReopenSetup()}
        onLanguageChange={(nextLanguage) => void handleLanguageChange(nextLanguage)}
        onSettingsSaved={() => {
          void refreshMeta()
          setConnectRefreshToken((token) => token + 1)
        }}
        refreshToken={attendees.length}
      />
    </div>
  )
}
