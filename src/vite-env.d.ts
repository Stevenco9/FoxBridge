/// <reference types="vite/client" />

import type { Attendee } from './shared/models'

interface ElectronAPI {
  getAttendees: () => Promise<Attendee[]>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
