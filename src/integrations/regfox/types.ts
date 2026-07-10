/**
 * Result of a RegFox connection test.
 * Returns only success/failure and an optional error message.
 */
import type { RegFoxSanitizedErrorResponse } from './regfoxErrorResponse'

export type { RegFoxSanitizedErrorResponse } from './regfoxErrorResponse'

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

export interface RegFoxCheckInSuccess {
  success: true
  registrantId: string
  checkedInAt?: string
  alreadyCheckedIn: boolean
}

export interface RegFoxCheckInFailure {
  success: false
  httpStatus: number | null
  message: string
  diagnosis?: RegFoxSanitizedErrorResponse
}

export type RegFoxCheckInResult = RegFoxCheckInSuccess | RegFoxCheckInFailure

export interface RegFoxCheckInParams {
  registrationId: string
  confirmationCode?: string | null
}
