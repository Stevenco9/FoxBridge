import { useCallback, useEffect, useState } from 'react'
import AttendeeSearchScreen from './features/attendees/AttendeeSearchScreen'
import SetupWizard from './features/setup/SetupWizard'
import './App.css'

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [setupComplete, setSetupComplete] = useState(false)
  const [forceSetup, setForceSetup] = useState(false)

  const refreshSetupState = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.initializeSettings) {
      setIsBootstrapping(false)
      return
    }

    const settings = await window.electronAPI.initializeSettings()
    setSetupComplete(settings.setupComplete)
    setIsBootstrapping(false)
  }, [])

  useEffect(() => {
    void refreshSetupState()
  }, [refreshSetupState])

  const handleSetupComplete = (): void => {
    setForceSetup(false)
    setSetupComplete(true)
  }

  const handleReopenSetup = (): void => {
    setForceSetup(true)
  }

  if (isBootstrapping) {
    return (
      <div className="app-loading" role="status">
        Loading FoxBridge…
      </div>
    )
  }

  if (!setupComplete || forceSetup) {
    return <SetupWizard onComplete={handleSetupComplete} />
  }

  return <AttendeeSearchScreen onReopenSetup={handleReopenSetup} />
}
