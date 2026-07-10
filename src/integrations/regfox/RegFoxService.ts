import type { Attendee } from '../../shared/models'
import { mapRegistrantToAttendee } from './mapRegistrantToAttendee'
import type {
  RegFoxCheckInResponseData,
  RegFoxListResponse,
  RegFoxMutationResponse,
  RegFoxRegistrant,
} from './regfoxTypes'
import type {
  ConnectionTestResult,
  RegFoxCheckInParams,
  RegFoxCheckInResult,
  RegFoxServiceConfig,
} from './types'
import {
  isRegFoxAlreadyCheckedInResponse,
  normalizeRegFoxErrorResponse,
  readRegFoxResponseBodyOnce,
} from './regfoxErrorResponse'

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

  /**
   * Marks a registrant checked in via POST /v2/public/registrant/check-in.
   *
   * Identifies the registrant by numeric RegFox id (`registrationId` → `{ id }`).
   * Falls back to confirmation code / displayId only when registrationId is not numeric.
   */
  async checkInRegistrant(params: RegFoxCheckInParams): Promise<RegFoxCheckInResult> {
    const body = this.buildCheckInBody(params)
    if (!body) {
      return {
        success: false,
        httpStatus: null,
        message: 'RegFox registrant id is missing.',
      }
    }

    try {
      const response = await this.postRequest('/registrant/check-in', body)
      const responseBody = await readRegFoxResponseBodyOnce(response)
      const parsed = responseBody.parsed as RegFoxMutationResponse<RegFoxCheckInResponseData> | null

      if (response.ok && parsed != null && this.isSuccessfulMutation(parsed)) {
        return {
          success: true,
          registrantId: String(parsed.data?.id ?? params.registrationId),
          checkedInAt: parsed.data?.date ?? new Date().toISOString(),
          alreadyCheckedIn: false,
        }
      }

      const diagnosis = normalizeRegFoxErrorResponse(response.status, responseBody)
      const errorMessage =
        diagnosis.message ?? `RegFox request failed with status ${response.status}.`

      if (isRegFoxAlreadyCheckedInResponse(responseBody.parsed)) {
        return {
          success: true,
          registrantId: params.registrationId,
          checkedInAt: undefined,
          alreadyCheckedIn: true,
        }
      }

      return {
        success: false,
        httpStatus: response.status,
        message: errorMessage,
        diagnosis,
      }
    } catch (error) {
      return {
        success: false,
        httpStatus: null,
        message:
          error instanceof Error
            ? error.message
            : 'Unexpected network error during RegFox check-in.',
      }
    }
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

  private async postRequest(path: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        apiKey: this.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  /**
   * Prefer numeric RegFox registrant id. Use displayId only when registrationId
   * is missing or not numeric (e.g. legacy cache rows).
   */
  private buildCheckInBody(
    params: RegFoxCheckInParams,
  ): { id: number } | { displayId: string } | null {
    const registrationId = params.registrationId.trim()
    if (registrationId.length > 0 && /^\d+$/.test(registrationId)) {
      return { id: Number(registrationId) }
    }

    const confirmationCode = params.confirmationCode?.trim()
    if (confirmationCode) {
      return { displayId: confirmationCode }
    }

    return null
  }

  private isSuccessfulMutation(body: RegFoxMutationResponse<unknown>): boolean {
    return body.responseCode == null || body.responseCode === 200
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
    body?: WebconnexErrorBody | RegFoxListResponse<unknown> | RegFoxMutationResponse<unknown> | null,
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
