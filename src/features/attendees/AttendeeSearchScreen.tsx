import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Attendee } from '../../shared/models'
import type { AppLanguage, SetupStatus } from '../../shared/models/AppSettings'
import BadgePreviewPanel from '../badge/BadgePreview'
import AttendeeCheckInPanel from './AttendeeCheckInPanel'
import AttendeePaymentPanel, {
  AttendeePaymentListBadge,
} from './AttendeePaymentPanel'
import AttendeeQuickInfoPanel from './AttendeeQuickInfoPanel'
import { DEFAULT_BADGE_LAYOUT, type BadgeLayoutSelection } from '../badge/badgeFields'
import ConnectPhonePanel from '../operations/ConnectPhonePanel'
import ConnectFoxBridgeSyncPanel from '../operations/ConnectFoxBridgeSyncPanel'
import ConnectedDesktopsPanel from '../operations/ConnectedDesktopsPanel'
import OperationsHome from '../operations/OperationsHome'
import EventSettingsPanel from '../eventSettings/EventSettingsPanel'
import MealDashboardPanel from '../meals/MealDashboardPanel'
import MealValidationPanel from '../meals/MealValidationPanel'
import SettingsModal from '../settings/SettingsModal'
import { useUpdateStatus } from '../../hooks/useUpdateStatus'
import { shouldShowSettingsUpdateBadge } from '../../shared/update/updateUiHelpers'
import { getAttendeeFullName, searchAttendees } from './searchAttendees'
import { buildOperationsHomeRefreshToken } from '../../shared/sync/foxbridgeSyncStatus'
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
  const [foxbridgeSyncOpen, setFoxbridgeSyncOpen] = useState(false)
  const [connectedDesksOpen, setConnectedDesksOpen] = useState(false)
  const [mealDashboardOpen, setMealDashboardOpen] = useState(false)
  const [eventSettingsOpen, setEventSettingsOpen] = useState(false)
  const [connectRefreshToken, setConnectRefreshToken] = useState(0)
  const [quickInfoRefreshToken, setQuickInfoRefreshToken] = useState(0)
  const {
    status: updateStatus,
    checkForUpdates,
    downloadUpdate,
    restartAndInstallUpdate,
    refreshUpdateStatus,
  } = useUpdateStatus()
  const showSettingsUpdateBadge = shouldShowSettingsUpdateBadge(updateStatus.state)
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

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onAttendeesChanged?.(() => {
      void loadAttendees()
    })
    return () => {
      unsubscribe?.()
    }
  }, [loadAttendees])

  const filteredAttendees = useMemo(
    () => searchAttendees(attendees, query),
    [attendees, query],
  )

  const selectedAttendee =
    filteredAttendees.find((attendee) => attendee.id === selectedId) ??
    attendees.find((attendee) => attendee.id === selectedId) ??
    null

  const handleReopenSetup = (): void => {
    // Sprint 23.2: lock is performed by App after confirmation — do not resetSetup
    // (preserves setupComplete and all persistent event data).
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
        showSettingsUpdateBadge={showSettingsUpdateBadge}
        refreshToken={buildOperationsHomeRefreshToken({
          attendeeCount: attendees.length,
          syncCredentialEpoch: connectRefreshToken,
        })}
        onConnectPhone={() => setConnectPhoneOpen(true)}
        onOpenFoxBridgeSync={() => setFoxbridgeSyncOpen(true)}
        onOpenConnectedDesks={() => setConnectedDesksOpen(true)}
        onOpenMealDashboard={() => setMealDashboardOpen(true)}
        onOpenEventSettings={() => setEventSettingsOpen(true)}
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
                        <AttendeePaymentListBadge payment={attendee.payment} />
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
          <section className="meal-validation-column">
            <MealValidationPanel
              attendees={attendees}
              selectedAttendee={selectedAttendee}
            />
          </section>
        )}

        {selectedAttendee && (
          <section ref={badgeRef} className="attendee-detail">
            <AttendeePaymentPanel payment={selectedAttendee.payment} />
            <AttendeeQuickInfoPanel
              attendee={selectedAttendee}
              attendees={attendees}
              refreshToken={quickInfoRefreshToken}
            />
            <AttendeeCheckInPanel
              attendee={selectedAttendee}
              onCheckedIn={(updated) => {
                setAttendees((current) =>
                  current.map((entry) => (entry.id === updated.id ? updated : entry)),
                )
              }}
            />
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

      <ConnectFoxBridgeSyncPanel
        language={language}
        open={foxbridgeSyncOpen}
        refreshToken={connectRefreshToken}
        onClose={() => {
          setFoxbridgeSyncOpen(false)
          // Always re-read Sync status on close so a failed join cannot leave a
          // stale Connected label from an earlier session state.
          void refreshMeta()
          setConnectRefreshToken((token) => token + 1)
        }}
        onChanged={() => {
          void refreshMeta()
          setConnectRefreshToken((token) => token + 1)
        }}
      />

      <ConnectedDesktopsPanel
        language={language}
        open={connectedDesksOpen}
        refreshToken={connectRefreshToken}
        onClose={() => setConnectedDesksOpen(false)}
      />

      <MealDashboardPanel
        open={mealDashboardOpen}
        attendees={attendees}
        onClose={() => setMealDashboardOpen(false)}
      />

      <EventSettingsPanel
        open={eventSettingsOpen}
        attendees={attendees}
        onClose={() => {
          setEventSettingsOpen(false)
          setQuickInfoRefreshToken((token) => token + 1)
        }}
      />

      <SettingsModal
        language={language}
        setupStatus={setupStatus}
        open={settingsOpen}
        updateStatus={updateStatus}
        onCheckForUpdates={checkForUpdates}
        onDownloadUpdate={downloadUpdate}
        onRestartAndInstallUpdate={restartAndInstallUpdate}
        onRefreshUpdateStatus={refreshUpdateStatus}
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
