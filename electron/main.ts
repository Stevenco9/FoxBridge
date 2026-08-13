import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDatabase, getDatabase } from './db/database'
import { registerBadgePrintHandlers } from './badgePrintHandlers'
import { registerCloudHandlers } from './cloudHandlers'
import { registerEventSettingsHandlers } from './eventSettingsHandlers'
import { registerMealValidationHandlers } from './mealValidationHandlers'
import { registerPrintHandlers } from './printHandlers'
import { registerRegFoxHandlers } from './regfoxHandlers'
import { registerSettingsHandlers } from './settingsHandlers'
import { registerEventAccessSessionHandlers } from './session/eventAccessHandlers'
import { registerEventAccessSessionLifecycle } from './session/eventAccessLifecycle'
import { initializeSettings } from './settings/settingsService'
import {
  ensureActiveEventIdentityFromSettings,
  resolveLocalEventStoreKey,
} from './settings/eventIdentityService'
import { hydrateAttendeeCacheFromLocalEventStore } from './scannerServer/attendeeCache'
import {
  registerScannerServerHandlers,
  stopScannerServer,
} from './scannerServerHandlers'
import { stopDesktopSyncManager } from './sync/syncManager'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    title: 'FoxBridge',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  getDatabase()
  await initializeSettings()
  try {
    // Hydrate Local Event Store into memory for later unlock — do not expose via IPC while locked.
    await ensureActiveEventIdentityFromSettings()
    const storeKey = await resolveLocalEventStoreKey()
    hydrateAttendeeCacheFromLocalEventStore(storeKey)
  } catch (error) {
    console.warn(
      '[local-event-store]',
      error instanceof Error ? error.message : String(error),
    )
  }
  registerEventAccessSessionLifecycle()
  registerEventAccessSessionHandlers()
  registerSettingsHandlers()
  registerEventSettingsHandlers()
  registerRegFoxHandlers()
  registerPrintHandlers()
  registerBadgePrintHandlers()
  registerMealValidationHandlers()
  registerScannerServerHandlers()
  registerCloudHandlers()
  createWindow()
  // Sprint 23.1: do NOT start Sync Manager or scanner until EventAccessSession unlocks.
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    getDatabase()
    registerEventAccessSessionHandlers()
    registerSettingsHandlers()
    registerEventSettingsHandlers()
    registerRegFoxHandlers()
    registerPrintHandlers()
    registerBadgePrintHandlers()
    registerMealValidationHandlers()
    registerScannerServerHandlers()
    registerCloudHandlers()
    createWindow()
  }
})

app.on('will-quit', () => {
  stopDesktopSyncManager()
  void stopScannerServer()
  closeDatabase()
})
