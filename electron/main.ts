import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDatabase, getDatabase } from './db/database'
import { registerCloudHandlers } from './cloudHandlers'
import { registerMealValidationHandlers } from './mealValidationHandlers'
import { registerPrintHandlers } from './printHandlers'
import { registerRegFoxHandlers } from './regfoxHandlers'
import {
  maybeAutoStartScannerServer,
  registerScannerServerHandlers,
  stopScannerServer,
} from './scannerServerHandlers'

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
  registerRegFoxHandlers()
  registerPrintHandlers()
  registerMealValidationHandlers()
  registerScannerServerHandlers()
  registerCloudHandlers()
  createWindow()
  await maybeAutoStartScannerServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    getDatabase()
    registerRegFoxHandlers()
    registerPrintHandlers()
    registerMealValidationHandlers()
    registerScannerServerHandlers()
    registerCloudHandlers()
    createWindow()
  }
})

app.on('will-quit', () => {
  void stopScannerServer()
  closeDatabase()
})
