/**
 * Result of a RegFox connection test.
 * Returns only success/failure and an optional error message.
 */
export interface ConnectionTestResult {
  success: boolean
  message?: string
}

/**
 * Configuration for the RegFox integration service.
 */
export interface RegFoxServiceConfig {
  apiKey: string
  eventId: string
  baseUrl?: string
}
