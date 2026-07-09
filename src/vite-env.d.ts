/// <reference types="vite/client" />

import type { Attendee } from './shared/models'

interface ElectronAPI {
  getAttendees: () => Promise<Attendee[]>
  printBadgePreview: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
