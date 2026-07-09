import { loadRegFoxEnv } from '../../shared/config/regfoxEnv'
import type { ConnectionTestResult, RegFoxServiceConfig } from './types'
import { RegFoxService } from './RegFoxService'

/**
 * Creates a RegFoxService using credentials from the local .env file.
 */
export function createRegFoxServiceFromEnv(rootDir?: string): RegFoxService {
  const { apiKey, eventId } = loadRegFoxEnv(rootDir)
  return new RegFoxService({ apiKey, eventId })
}

export { RegFoxService }
export type { ConnectionTestResult, RegFoxServiceConfig }
