import type { AppLanguage } from '../../shared/models/AppSettings'
import { translate } from '../../i18n/messages'
import FoxBridgeSyncEnrollment from '../sync/FoxBridgeSyncEnrollment'
import './ConnectFoxBridgeSyncPanel.css'

interface ConnectFoxBridgeSyncPanelProps {
  language: AppLanguage
  open: boolean
  onClose: () => void
  onChanged?: () => void
  refreshToken?: number | string
}

export default function ConnectFoxBridgeSyncPanel({
  language,
  open,
  onClose,
  onChanged,
  refreshToken,
}: ConnectFoxBridgeSyncPanelProps) {
  if (!open) {
    return null
  }

  return (
    <div className="connect-sync" role="dialog" aria-modal="true" aria-labelledby="connect-sync-title">
      <button
        type="button"
        className="connect-sync__backdrop"
        aria-label={translate(language, 'connect.close')}
        onClick={onClose}
      />
      <section className="connect-sync__panel">
        <h2 id="connect-sync-title" className="connect-sync__title">
          {translate(language, 'sync.title')}
        </h2>
        <FoxBridgeSyncEnrollment
          language={language}
          variant="panel"
          refreshToken={refreshToken}
          onEnrolled={() => {
            onChanged?.()
          }}
        />
        <button type="button" className="connect-sync__close" onClick={onClose}>
          {translate(language, 'connect.close')}
        </button>
      </section>
    </div>
  )
}
