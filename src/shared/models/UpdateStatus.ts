/** Safe update lifecycle states exposed to the renderer via IPC. */
export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'upToDate'
  | 'error'

/** Renderer-safe auto-update snapshot. No credentials or internal paths. */
export interface UpdateStatus {
  state: UpdateState
  /** False in development / unpackaged runs (`npm run dev`). */
  updaterEnabled: boolean
  currentVersion: string
  availableVersion: string | null
  downloadPercent: number | null
  errorSafeMessage: string | null
  lastCheckedAt: string | null
}
