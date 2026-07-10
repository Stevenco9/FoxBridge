import { RegFoxService } from '../../src/integrations/regfox/RegFoxService'
import { loadRegFoxEnv } from '../../src/shared/config/regfoxEnv'
import { readSecrets } from '../settings/secretStore'
import { isPlaceholderRegFoxValue, readPublicSettings } from '../settings/settingsStore'

export async function createRegFoxServiceFromSettings(): Promise<RegFoxService | null> {
  const [secrets, settings] = await Promise.all([readSecrets(), readPublicSettings()])

  const apiKey = secrets.regfoxApiKey ?? process.env.REGFOX_API_KEY
  const eventId = settings.regfoxEventId ?? process.env.REGFOX_EVENT_ID

  if (
    apiKey &&
    eventId &&
    !isPlaceholderRegFoxValue(apiKey) &&
    !isPlaceholderRegFoxValue(eventId)
  ) {
    return new RegFoxService({ apiKey, eventId })
  }

  try {
    const env = loadRegFoxEnv()
    return new RegFoxService({ apiKey: env.apiKey, eventId: env.eventId })
  } catch {
    return null
  }
}
