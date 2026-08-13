import { useCallback, useEffect, useState } from 'react'
import AttendeeSearchScreen from './features/attendees/AttendeeSearchScreen'
import SetupWizard from './features/setup/SetupWizard'
import './App.css'

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [setupComplete, setSetupComplete] = useState(false)
  const [forceSetup, setForceSetup] = useState(false)
  /** Assume locked until status resolves — prevents Operations Home flash. */
  const [eventLocked, setEventLocked] = useState(true)

  const refreshSetupState = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.initializeSettings) {
      setEventLocked(false)
      setIsBootstrapping(false)
      return
    }

    const settings = await window.electronAPI.initializeSettings()
    setSetupComplete(settings.setupComplete)

    if (window.electronAPI.getEventAccessStatus) {
      const access = await window.electronAPI.getEventAccessStatus()
      setEventLocked(access.locked)
    } else {
      setEventLocked(false)
    }

    setIsBootstrapping(false)
  }, [])

  useEffect(() => {
    void refreshSetupState()
  }, [refreshSetupState])

  const handleSetupComplete = (): void => {
    setForceSetup(false)
    setSetupComplete(true)
    void refreshSetupState()
  }

  const handleEventUnlocked = (): void => {
    setForceSetup(false)
    void refreshSetupState()
  }

  const handleLockAndReopenSetup = async (): Promise<void> => {
    if (window.electronAPI?.lockEventAccess) {
      await window.electronAPI.lockEventAccess()
    }
    setForceSetup(true)
    setEventLocked(true)
  }

  if (isBootstrapping) {
    return (
      <div className="app-loading" role="status">
        Loading FoxBridge…
      </div>
    )
  }

  // Authorization truth is EventAccessSession — setupComplete never bypasses lock.
  if (eventLocked || !setupComplete || forceSetup) {
    return (
      <SetupWizard
        onComplete={handleSetupComplete}
        onEventUnlocked={handleEventUnlocked}
        returningUser={setupComplete}
      />
    )
  }

  return <AttendeeSearchScreen onReopenSetup={() => void handleLockAndReopenSetup()} />
}
