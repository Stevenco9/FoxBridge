import { ipcMain } from 'electron'
import {
  completeSetup,
  getPublicSettings,
  getSetupStatus,
  initializeSettings,
  resetSetup,
  savePublicSettings,
  saveSettingsSecrets,
} from './settings/settingsService'
import { isEventAccessUnlocked } from './session/eventAccessSession'
import type { AppSettingsPublic } from '../src/shared/models/AppSettings'

export function registerSettingsHandlers(): void {
  ipcMain.removeHandler('settings:initialize')
  ipcMain.handle('settings:initialize', async () => {
    await initializeSettings()
    return getPublicSettings()
  })

  ipcMain.removeHandler('settings:getPublic')
  ipcMain.handle('settings:getPublic', async () => getPublicSettings())

  ipcMain.removeHandler('settings:savePublic')
  ipcMain.handle('settings:savePublic', async (_event, patch: Partial<AppSettingsPublic>) => {
    if (!isEventAccessUnlocked()) {
      // While locked, only harmless prefs (language) may be saved.
      const lockedPatch: Partial<AppSettingsPublic> = {}
      if (patch?.language === 'en' || patch?.language === 'es') {
        lockedPatch.language = patch.language
      }
      return savePublicSettings(lockedPatch)
    }
    return savePublicSettings(patch)
  })

  ipcMain.removeHandler('settings:saveSecrets')
  ipcMain.handle('settings:saveSecrets', async (_event, patch) => {
    // Allow RegFox key write during ownership setup while locked; never return secrets.
    await saveSettingsSecrets(patch)
  })

  ipcMain.removeHandler('settings:getSetupStatus')
  ipcMain.handle('settings:getSetupStatus', async (event) => {
    const printers = await event.sender.getPrintersAsync()
    return getSetupStatus(printers.map((printer) => printer.name))
  })

  ipcMain.removeHandler('settings:completeSetup')
  ipcMain.handle('settings:completeSetup', async () => completeSetup())

  ipcMain.removeHandler('settings:resetSetup')
  ipcMain.handle('settings:resetSetup', async () => resetSetup())
}
