import { useCallback, useEffect, useState } from 'react'
import type { UpdateStatus } from '../shared/models/UpdateStatus'
import { createDisabledUpdateStatus } from '../shared/update/updateManagerHelpers'

export interface UpdateStatusActions {
  status: UpdateStatus
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  restartAndInstallUpdate: () => Promise<void>
  refreshUpdateStatus: () => Promise<void>
}

export function useUpdateStatus(): UpdateStatusActions {
  const [status, setStatus] = useState<UpdateStatus>(() => createDisabledUpdateStatus('0.0.0'))

  const refreshUpdateStatus = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.getUpdateStatus) {
      return
    }
    const next = await window.electronAPI.getUpdateStatus()
    setStatus(next)
  }, [])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.getUpdateStatus || !api.onUpdateStatusChanged) {
      return
    }

    let active = true

    void api.getUpdateStatus().then((initial) => {
      if (active) {
        setStatus(initial)
      }
    })

    const unsubscribe = api.onUpdateStatusChanged((next) => {
      if (active) {
        setStatus(next)
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const checkForUpdates = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.checkForUpdates) {
      return
    }
    try {
      const next = await window.electronAPI.checkForUpdates()
      setStatus(next)
    } catch {
      await refreshUpdateStatus()
    }
  }, [refreshUpdateStatus])

  const downloadUpdate = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.downloadUpdate) {
      return
    }
    try {
      const next = await window.electronAPI.downloadUpdate()
      setStatus(next)
    } catch {
      await refreshUpdateStatus()
    }
  }, [refreshUpdateStatus])

  const restartAndInstallUpdate = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.restartAndInstallUpdate) {
      return
    }
    try {
      await window.electronAPI.restartAndInstallUpdate()
    } catch {
      await refreshUpdateStatus()
    }
  }, [refreshUpdateStatus])

  return {
    status,
    checkForUpdates,
    downloadUpdate,
    restartAndInstallUpdate,
    refreshUpdateStatus,
  }
}
