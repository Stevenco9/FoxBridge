import type { ConnectionTestResult, RegFoxServiceConfig } from './types'

const DEFAULT_BASE_URL = 'https://api.webconnex.com/v2/public'

interface WebconnexErrorBody {
  responseCode?: number
  error?: {
    message?: string
  }
}

/**
 * RegFox integration service.
 *
 * Handles authenticated requests to the RegFox / Webconnex API.
 * Future sync and data methods will be added here.
 */
export class RegFoxService {
  private readonly apiKey: string
  private readonly eventId: string
  private readonly baseUrl: string

  constructor(config: RegFoxServiceConfig) {
    this.apiKey = config.apiKey
    this.eventId = config.eventId
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
  }

  /**
   * Verifies API credentials by fetching metadata for the configured event form.
   * Does not download attendees or modify any registrations.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const url = `${this.baseUrl}/forms/${this.eventId}`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          apiKey: this.apiKey,
          Accept: 'application/json',
        },
      })

      if (response.ok) {
        return { success: true }
      }

      return {
        success: false,
        message: await this.buildErrorMessage(response),
      }
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? `Unable to reach RegFox: ${error.message}`
            : 'Unable to reach RegFox due to an unexpected network error.',
      }
    }
  }

  private async buildErrorMessage(response: Response): Promise<string> {
    const body = await this.readErrorBody(response)

    if (response.status === 401) {
      return (
        body?.error?.message ??
        'Authentication failed. Check that REGFOX_API_KEY is valid.'
      )
    }

    if (response.status === 403) {
      return (
        body?.error?.message ??
        'Access denied. This API key may not have permission to access RegFox.'
      )
    }

    if (response.status === 404) {
      return (
        body?.error?.message ??
        'Event not found. Check that REGFOX_EVENT_ID matches your RegFox form.'
      )
    }

    if (body?.error?.message) {
      return body.error.message
    }

    return `RegFox request failed with status ${response.status}.`
  }

  private async readErrorBody(response: Response): Promise<WebconnexErrorBody | null> {
    try {
      return (await response.json()) as WebconnexErrorBody
    } catch {
      return null
    }
  }
}
