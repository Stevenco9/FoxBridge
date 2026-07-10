import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

const SETTINGS_DIRNAME = 'settings'
const SETTINGS_FILENAME = 'app-settings.json'

export function getSettingsDirectory(): string {
  return path.join(app.getPath('userData'), SETTINGS_DIRNAME)
}

export function getSettingsFilePath(): string {
  return path.join(getSettingsDirectory(), SETTINGS_FILENAME)
}

export async function ensureSettingsDirectory(): Promise<void> {
  await fs.mkdir(getSettingsDirectory(), { recursive: true })
}
