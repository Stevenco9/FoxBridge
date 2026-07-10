import { useCallback, useEffect, useState } from 'react'
import type { CloudStatus } from '../../shared/models/CloudStatus'
import type { MobileScannerInfo } from '../../shared/models/MobileScannerInfo'
import './ConferenceModePanel.css'

const EMPTY_CLOUD_STATUS: CloudStatus = {
  configured: false,
  connected: false,
  conferenceId: null,
  conferenceName: null,
  lastPublishAt: null,
  lastPublishAttendeeCount: null,
  lastPublishError: null,
}

interface ConferenceModePanelProps {
  attendeeCount: number
  isLoadingAttendees: boolean
  attendeeError: string | null
  hasSelectedAttendee: boolean
  refreshToken?: number | string
  onReloadAttendees: () => void
  onScrollToBadge: () => void
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Not yet'
  }

  return new Date(value).toLocaleString()
}

export default function ConferenceModePanel({
  attendeeCount,
  isLoadingAttendees,
  attendeeError,
  hasSelectedAttendee,
  refreshToken,
  onReloadAttendees,
  onScrollToBadge,
}: ConferenceModePanelProps) {
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(EMPTY_CLOUD_STATUS)
  const [mobileInfo, setMobileInfo] = useState<MobileScannerInfo | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.getCloudStatus || !window.electronAPI?.getMobileScannerInfo) {
      return
    }

    try {
      const [nextCloudStatus, nextMobileInfo] = await Promise.all([
        window.electronAPI.getCloudStatus(),
        window.electronAPI.getMobileScannerInfo(),
      ])
      setCloudStatus(nextCloudStatus)
      setMobileInfo(nextMobileInfo)
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : 'Unable to refresh conference status.'
      setActionError(message)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshToken])

  const handlePublish = async (): Promise<void> => {
    if (!window.electronAPI?.publishAttendees) {
      setActionError('Mobile scanner sync is only available in the desktop app.')
      return
    }

    setIsPublishing(true)
    setActionError(null)

    try {
      const result = await window.electronAPI.publishAttendees()
      if (!result.success && result.error) {
        setActionError(result.error)
      }

      await refresh()
    } catch (publishError) {
      const message =
        publishError instanceof Error
          ? publishError.message
          : 'Unable to send attendees to the mobile scanner.'
      setActionError(message)
    } finally {
      setIsPublishing(false)
    }
  }

  const handleCopyUrl = async (): Promise<void> => {
    if (!mobileInfo?.mobileScannerUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(mobileInfo.mobileScannerUrl)
      setCopiedUrl(true)
      window.setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      setActionError('Unable to copy the URL. Select and copy it manually.')
    }
  }

  const mobileReady = cloudStatus.configured && cloudStatus.connected
  const step1Done = !isLoadingAttendees && !attendeeError && attendeeCount > 0
  const step2Done =
    cloudStatus.lastPublishAttendeeCount != null && cloudStatus.lastPublishAttendeeCount > 0

  return (
    <section className="conference-mode" aria-labelledby="conference-mode-title">
      <div className="conference-mode__intro">
        <h2 id="conference-mode-title" className="conference-mode__title">
          AdAgrA Conference Mode
        </h2>
        <p className="conference-mode__subtitle">
          Follow these steps to load attendees, send them to volunteers, and test the mobile scanner.
        </p>
      </div>

      {!cloudStatus.configured && (
        <div className="conference-mode__alert" role="status">
          Mobile scanner is not ready yet. Add Supabase settings first.
        </div>
      )}

      <ol className="conference-mode__steps">
        <li className={`conference-mode__step${step1Done ? ' conference-mode__step--done' : ''}`}>
          <div className="conference-mode__step-header">
            <span className="conference-mode__step-number">1</span>
            <div>
              <h3 className="conference-mode__step-title">Sync / load attendees</h3>
              <p className="conference-mode__step-text">
                Pull the latest registration list from RegFox into FoxBridge.
              </p>
            </div>
          </div>
          <div className="conference-mode__step-body">
            {isLoadingAttendees && (
              <p className="conference-mode__status" role="status">
                Loading attendees from RegFox…
              </p>
            )}
            {!isLoadingAttendees && attendeeError && (
              <p className="conference-mode__error" role="alert">
                {attendeeError}
              </p>
            )}
            {!isLoadingAttendees && !attendeeError && (
              <p className="conference-mode__status">
                {attendeeCount} attendee{attendeeCount === 1 ? '' : 's'} loaded
              </p>
            )}
            <button
              type="button"
              className="conference-mode__button"
              onClick={onReloadAttendees}
              disabled={isLoadingAttendees}
            >
              {isLoadingAttendees ? 'Loading…' : 'Reload from RegFox'}
            </button>
          </div>
        </li>

        <li className={`conference-mode__step${step2Done ? ' conference-mode__step--done' : ''}`}>
          <div className="conference-mode__step-header">
            <span className="conference-mode__step-number">2</span>
            <div>
              <h3 className="conference-mode__step-title">Send attendees to mobile scanner</h3>
              <p className="conference-mode__step-text">
                Upload attendee and meal data so volunteers can scan badges on their phones.
              </p>
            </div>
          </div>
          <div className="conference-mode__step-body">
            <p className="conference-mode__status">
              Last sent: {formatTimestamp(cloudStatus.lastPublishAt)}
              {cloudStatus.lastPublishAttendeeCount != null &&
                ` · ${cloudStatus.lastPublishAttendeeCount} attendee${
                  cloudStatus.lastPublishAttendeeCount === 1 ? '' : 's'
                }`}
            </p>
            <button
              type="button"
              className="conference-mode__button conference-mode__button--primary"
              onClick={() => void handlePublish()}
              disabled={isPublishing || !cloudStatus.configured || !step1Done}
            >
              {isPublishing ? 'Sending…' : 'Send attendees to mobile scanner'}
            </button>
          </div>
        </li>

        <li className="conference-mode__step">
          <div className="conference-mode__step-header">
            <span className="conference-mode__step-number">3</span>
            <div>
              <h3 className="conference-mode__step-title">Print badges</h3>
              <p className="conference-mode__step-text">
                Select an attendee below, review the badge preview, then print.
              </p>
            </div>
          </div>
          <div className="conference-mode__step-body">
            <p className="conference-mode__status">
              {hasSelectedAttendee
                ? 'Attendee selected — use the badge panel on the right to print.'
                : 'Choose an attendee from the list to open the badge preview.'}
            </p>
            <button
              type="button"
              className="conference-mode__button"
              onClick={onScrollToBadge}
              disabled={!hasSelectedAttendee}
            >
              Go to badge preview
            </button>
          </div>
        </li>

        <li className="conference-mode__step">
          <div className="conference-mode__step-header">
            <span className="conference-mode__step-number">4</span>
            <div>
              <h3 className="conference-mode__step-title">Open mobile scanner</h3>
              <p className="conference-mode__step-text">
                Volunteers use the mobile app to sign in and validate meals.
              </p>
            </div>
          </div>
          <div className="conference-mode__step-body">
            {!mobileReady ? (
              <p className="conference-mode__status">
                {cloudStatus.configured
                  ? 'Supabase is configured but not connected. Check your settings and try again.'
                  : 'Set up Supabase in .env before testing the mobile scanner.'}
              </p>
            ) : (
              <div className="conference-mode__mobile-test">
                <div className="conference-mode__mobile-field">
                  <span className="conference-mode__mobile-label">Mobile app URL</span>
                  <div className="conference-mode__url-row">
                    <code className="conference-mode__url">{mobileInfo?.mobileScannerUrl}</code>
                    <button
                      type="button"
                      className="conference-mode__button conference-mode__button--small"
                      onClick={() => void handleCopyUrl()}
                    >
                      {copiedUrl ? 'Copied' : 'Copy URL'}
                    </button>
                  </div>
                </div>

                <div className="conference-mode__mobile-field">
                  <span className="conference-mode__mobile-label">Scanner codes</span>
                  {mobileInfo?.scannerSessions.length ? (
                    <ul className="conference-mode__codes">
                      {mobileInfo.scannerSessions.map((session) => (
                        <li key={session.code} className="conference-mode__code-item">
                          <code className="conference-mode__code">{session.code}</code>
                          <span className="conference-mode__code-label">{session.label}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="conference-mode__status">
                      No scanner codes found. Add rows to the scanner_sessions table in Supabase.
                    </p>
                  )}
                </div>

                <ol className="conference-mode__instructions">
                  <li>Open this URL on your phone</li>
                  <li>Enter a scanner code and your name</li>
                  <li>Scan a badge QR code to validate meals</li>
                </ol>

                {cloudStatus.conferenceName && (
                  <p className="conference-mode__status">
                    Conference: {cloudStatus.conferenceName}
                  </p>
                )}
              </div>
            )}
          </div>
        </li>
      </ol>

      {(actionError || cloudStatus.lastPublishError || mobileInfo?.error) && (
        <p className="conference-mode__error" role="alert">
          {actionError ?? cloudStatus.lastPublishError ?? mobileInfo?.error}
        </p>
      )}
    </section>
  )
}
