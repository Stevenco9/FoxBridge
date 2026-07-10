/**
 * Normalized, sanitized RegFox / Webconnex API error details for logging.
 * Excludes secrets, request data, and registrant PII.
 */
export interface RegFoxSanitizedErrorResponse {
  httpStatus: number | null
  errorCode?: string | number
  message?: string
  responseKeys?: string[]
  /** Truncated JSON or text body safe for diagnostic logs. */
  sanitizedBody?: string
}

const MAX_SANITIZED_BODY_LENGTH = 2000

const REDACTED_KEY_PATTERN =
  /^(api[_-]?key|authorization|token|secret|password|firstname|last(name)?|email|phone|billing|orderemail|company|organization|jobtitle|department|fielddata|address|street|city|state|zip|postal|country|name)$/i

export interface RegFoxRawResponseBody {
  raw: string
  parsed: unknown | null
}

export async function readRegFoxResponseBodyOnce(
  response: Response,
): Promise<RegFoxRawResponseBody> {
  const raw = await response.text()

  if (!raw.trim()) {
    return { raw: '', parsed: null }
  }

  try {
    return { raw, parsed: JSON.parse(raw) as unknown }
  } catch {
    return { raw, parsed: null }
  }
}

function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return '[truncated-depth]'
  }

  if (value == null || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return '[redacted-email]'
    }

    return value.length > 500 ? `${value.slice(0, 500)}…` : value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeUnknown(item, depth + 1))
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = REDACTED_KEY_PATTERN.test(key)
        ? '[redacted]'
        : sanitizeUnknown(child, depth + 1)
    }
    return sanitized
  }

  return String(value)
}

function truncateSerializedBody(serialized: string): string {
  if (serialized.length <= MAX_SANITIZED_BODY_LENGTH) {
    return serialized
  }

  return `${serialized.slice(0, MAX_SANITIZED_BODY_LENGTH)}…`
}

function extractMessage(parsed: unknown): string | undefined {
  if (parsed == null || typeof parsed !== 'object') {
    return undefined
  }

  const record = parsed as Record<string, unknown>

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message
  }

  const error = record.error
  if (error != null && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>
  if (typeof errorRecord.message === 'string' && errorRecord.message.trim()) {
    return errorRecord.message
  }

  if (typeof errorRecord.description === 'string' && errorRecord.description.trim()) {
    return errorRecord.description
  }
  }

  return undefined
}

function extractErrorCode(parsed: unknown): string | number | undefined {
  if (parsed == null || typeof parsed !== 'object') {
    return undefined
  }

  const record = parsed as Record<string, unknown>

  if (typeof record.responseCode === 'number' || typeof record.responseCode === 'string') {
    return record.responseCode
  }

  const error = record.error
  if (error != null && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>
    if (typeof errorRecord.code === 'number' || typeof errorRecord.code === 'string') {
      return errorRecord.code
    }
  }

  if (typeof record.code === 'number' || typeof record.code === 'string') {
    return record.code
  }

  return undefined
}

export function normalizeRegFoxErrorResponse(
  httpStatus: number | null,
  body: RegFoxRawResponseBody,
): RegFoxSanitizedErrorResponse {
  const normalized: RegFoxSanitizedErrorResponse = { httpStatus }

  if (body.parsed != null && typeof body.parsed === 'object' && !Array.isArray(body.parsed)) {
    normalized.responseKeys = Object.keys(body.parsed as Record<string, unknown>)
    normalized.errorCode = extractErrorCode(body.parsed)
    normalized.message = extractMessage(body.parsed)

    try {
      normalized.sanitizedBody = truncateSerializedBody(
        JSON.stringify(sanitizeUnknown(body.parsed)),
      )
    } catch {
      normalized.sanitizedBody = truncateSerializedBody(body.raw)
    }
  } else if (body.raw.trim()) {
    normalized.sanitizedBody = truncateSerializedBody(body.raw)
    normalized.message = body.raw.slice(0, 500)
  }

  if (!normalized.message && httpStatus != null) {
    normalized.message = `RegFox request failed with status ${httpStatus}.`
  }

  return normalized
}

export function collectRegFoxErrorText(
  diagnosis: RegFoxSanitizedErrorResponse,
): string {
  return [diagnosis.message, diagnosis.sanitizedBody].filter(Boolean).join(' ')
}

/** RegFox returns HTTP 500 with error.code 8500 when the registrant is already checked in. */
export const REGFOX_ALREADY_CHECKED_IN_ERROR_CODE = 8500

export function isRegFoxAlreadyCheckedInResponse(parsed: unknown): boolean {
  if (parsed == null || typeof parsed !== 'object') {
    return false
  }

  const error = (parsed as Record<string, unknown>).error
  if (error == null || typeof error !== 'object') {
    return false
  }

  const errorRecord = error as Record<string, unknown>
  const code = errorRecord.code

  if (
    code === REGFOX_ALREADY_CHECKED_IN_ERROR_CODE ||
    code === String(REGFOX_ALREADY_CHECKED_IN_ERROR_CODE)
  ) {
    return true
  }

  if (typeof errorRecord.description === 'string') {
    return errorRecord.description.trim().toLowerCase() === 'already checked in'
  }

  return false
}
