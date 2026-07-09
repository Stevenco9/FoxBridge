import type { Attendee } from '../../shared/models'
import { mapRegistrantToAttendee } from './mapRegistrantToAttendee'
import type { RegFoxListResponse, RegFoxRegistrant } from './regfoxTypes'
import type { ConnectionTestResult, RegFoxServiceConfig } from './types'

const DEFAULT_BASE_URL = 'https://api.webconnex.com/v2/public'
const REGFOX_PRODUCT = 'regfox.com'
const PAGE_LIMIT = '50'

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
    try {
      const response = await this.request(`/forms/${this.eventId}`)
      return this.toConnectionResult(response)
    } catch (error) {
      return this.toNetworkFailure(error)
    }
  }

  /**
   * Downloads attendees for the configured event and maps them to FoxBridge models.
   * Does not persist or cache results.
   */
  async getAttendees(): Promise<Attendee[]> {
    const registrants = await this.fetchAllRegistrants()
    return registrants.map((registrant) =>
      mapRegistrantToAttendee(registrant, this.eventId),
    )
  }

  private async fetchAllRegistrants(): Promise<RegFoxRegistrant[]> {
    const registrants: RegFoxRegistrant[] = []
    let startingAfter: string | undefined

    do {
      const params: Record<string, string> = {
        product: REGFOX_PRODUCT,
        formId: this.eventId,
        limit: PAGE_LIMIT,
      }

      if (startingAfter) {
        params.startingAfter = startingAfter
      }

      const response = await this.request('/search/registrants', params)
      const body = await this.readJson<RegFoxListResponse<RegFoxRegistrant>>(response)

      if (!response.ok) {
        throw new Error(await this.buildErrorMessage(response, body))
      }

      const page = body.data ?? []
      registrants.push(...page)

      if (!body.hasMore || page.length === 0) {
        break
      }

      const lastId = page[page.length - 1]?.id
      startingAfter = lastId != null ? String(lastId) : undefined
    } while (startingAfter)

    return registrants
  }

  private async request(
    path: string,
    params?: Record<string, string>,
  ): Promise<Response> {
    const url = new URL(`${this.baseUrl}${path}`)

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
      }
    }

    return fetch(url, {
      method: 'GET',
      headers: {
        apiKey: this.apiKey,
        Accept: 'application/json',
      },
    })
  }

  private async toConnectionResult(response: Response): Promise<ConnectionTestResult> {
    if (response.ok) {
      return { success: true }
    }

    return {
      success: false,
      message: await this.buildErrorMessage(response),
    }
  }

  private toNetworkFailure(error: unknown): ConnectionTestResult {
    return {
      success: false,
      message:
        error instanceof Error
          ? `Unable to reach RegFox: ${error.message}`
          : 'Unable to reach RegFox due to an unexpected network error.',
    }
  }

  private async buildErrorMessage(
    response: Response,
    body?: WebconnexErrorBody | RegFoxListResponse<unknown> | null,
  ): Promise<string> {
    const parsed = body ?? (await this.readErrorBody(response))

    if (response.status === 401) {
      return (
        parsed?.error?.message ??
        'Authentication failed. Check that REGFOX_API_KEY is valid.'
      )
    }

    if (response.status === 403) {
      return (
        parsed?.error?.message ??
        'Access denied. This API key may not have permission to access RegFox.'
      )
    }

    if (response.status === 404) {
      return (
        parsed?.error?.message ??
        'Event not found. Check that REGFOX_EVENT_ID matches your RegFox form.'
      )
    }

    if (parsed?.error?.message) {
      return parsed.error.message
    }

    return `RegFox request failed with status ${response.status}.`
  }

  private async readJson<T>(response: Response): Promise<T> {
    return (await response.json()) as T
  }

  private async readErrorBody(response: Response): Promise<WebconnexErrorBody | null> {
    try {
      return (await response.json()) as WebconnexErrorBody
    } catch {
      return null
    }
  }
}
