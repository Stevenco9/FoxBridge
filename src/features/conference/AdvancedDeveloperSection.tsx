import { useState } from 'react'
import CloudStatusPanel from '../cloud/CloudStatusPanel'
import ScannerServerControls from '../scanner/ScannerServerControls'
import './AdvancedDeveloperSection.css'

interface AdvancedDeveloperSectionProps {
  refreshToken?: number | string
}

export default function AdvancedDeveloperSection({ refreshToken }: AdvancedDeveloperSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="advanced-section">
      <button
        type="button"
        className="advanced-section__toggle"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="advanced-section__toggle-label">Advanced / Developer</span>
        <span className="advanced-section__toggle-hint">
          {isOpen ? 'Hide technical tools' : 'Cloud status, scanner server, and other internal tools'}
        </span>
      </button>

      {isOpen && (
        <div className="advanced-section__content">
          <p className="advanced-section__note">
            These tools are for setup and troubleshooting. Volunteers normally use Conference Mode above.
          </p>
          <div className="advanced-section__panels">
            <CloudStatusPanel refreshToken={refreshToken} />
            <ScannerServerControls refreshToken={refreshToken} />
          </div>
        </div>
      )}
    </section>
  )
}
