import { createClient, type PostgrestError } from '@supabase/supabase-js'

const CONFERENCE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type SupabaseConnectionFailureKind =
  | 'invalid-url'
  | 'invalid-public-key'
  | 'invalid-desktop-key'
  | 'permission-schema'
  | 'network'

export interface SupabaseConnectionProbeDetails {
  step: 'url' | 'public-key' | 'desktop-key'
  httpStatus: number | null
  code: string | null
  sanitizedMessage: string | null
}

export interface SupabaseConnectionTestResult {
  success: boolean
  message: string | null
  failureKind: SupabaseConnectionFailureKind | null
  details: SupabaseConnectionProbeDetails | null
}

export function isConferenceUuid(value: string | null | undefined): boolean {
  return Boolean(value && CONFERENCE_UUID_RE.test(value))
}

export type SupabaseKeyKind = 'publishable' | 'secret' | 'legacy-jwt' | 'unknown'

export function classifySupabaseKey(key: string): SupabaseKeyKind {
  if (key.startsWith('sb_publishable_')) {
    return 'publishable'
  }
  if (key.startsWith('sb_secret_')) {
    return 'secret'
  }
  if (key.startsWith('eyJ')) {
    return 'legacy-jwt'
  }
  return 'unknown'
}

function jwtRole(key: string): string | null {
  if (!key.startsWith('eyJ')) {
    return null
  }

  try {
    const segment = key.split('.')[1]
    if (!segment) {
      return null
    }
    const payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as {
      role?: string
    }
    return payload.role ?? null
  } catch {
    return null
  }
}

function sanitizeErrorText(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/g, '[redacted]')
}

function logProbe(details: SupabaseConnectionProbeDetails): void {
  console.error('[supabase-connection-test]', JSON.stringify(details))
}

function validateServiceUrl(serviceUrl: string): string | null {
  try {
    const parsed = new URL(serviceUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'The service URL must start with https:// (or http:// for local testing).'
    }
    if (!parsed.hostname.includes('.')) {
      return 'The service URL does not look like a valid Supabase project address.'
    }
    return null
  } catch {
    return 'The service URL is not a valid web address. Use your Supabase project URL.'
  }
}

function validateKeyForField(
  key: string,
  field: 'public' | 'desktop',
): SupabaseConnectionFailureKind | null {
  const kind = classifySupabaseKey(key)

  if (field === 'public') {
    if (kind === 'secret') {
      return 'invalid-public-key'
    }
    const role = jwtRole(key)
    if (role === 'service_role') {
      return 'invalid-public-key'
    }
    return null
  }

  if (kind === 'publishable') {
    return 'invalid-desktop-key'
  }
  const role = jwtRole(key)
  if (role === 'anon') {
    return 'invalid-desktop-key'
  }
  return null
}

function messageForFailureKind(
  kind: SupabaseConnectionFailureKind,
  details: SupabaseConnectionProbeDetails | null,
): string {
  switch (kind) {
    case 'invalid-url':
      return 'The service URL is invalid or unreachable. Use your Supabase project URL, such as https://your-project.supabase.co.'
    case 'invalid-public-key':
      return 'The public key is invalid or the wrong type. Use the publishable key (sb_publishable_…) or legacy anon key — not the secret/service_role key.'
    case 'invalid-desktop-key':
      return 'The desktop connection key is invalid or the wrong type. Use the secret key (sb_secret_…) or legacy service_role key — not the publishable/anon key.'
    case 'network':
      return 'Could not reach the phone scanning service. Check your internet connection and the service URL.'
    case 'permission-schema':
      return details?.sanitizedMessage
        ? `Connected to the project, but a database permission or schema check failed (${details.sanitizedMessage}). Confirm migrations 001–006 are applied.`
        : 'Connected to the project, but a database permission or schema check failed. Confirm migrations 001–006 are applied.'
  }
}

function postgrestHttpStatus(error: PostgrestError): number | null {
  if (error.code === 'PGRST301') {
    return 401
  }
  if (error.code === '42501') {
    return 403
  }
  if (error.code === '22P02') {
    return 400
  }

  const withStatus = error as PostgrestError & { status?: number }
  return withStatus.status ?? null
}

function classifyPostgrestError(
  error: PostgrestError,
  field: 'public' | 'desktop',
): SupabaseConnectionFailureKind {
  const message = error.message.toLowerCase()

  if (postgrestHttpStatus(error) === 401 || error.code === 'PGRST301') {
    if (message.includes('invalid jwt') || message.includes('jwt')) {
      return field === 'public' ? 'invalid-public-key' : 'invalid-desktop-key'
    }
    return field === 'public' ? 'invalid-public-key' : 'invalid-desktop-key'
  }

  if (postgrestHttpStatus(error) === 403 || error.code === '42501') {
    return 'permission-schema'
  }

  if (error.code === '22P02' || error.code === 'PGRST204' || error.code === '42P01') {
    return 'permission-schema'
  }

  return field === 'public' ? 'invalid-public-key' : 'invalid-desktop-key'
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('fetch failed') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('network') ||
    message.includes('getaddrinfo')
  )
}

async function probeTableAccess(
  serviceUrl: string,
  key: string,
  step: 'public-key' | 'desktop-key',
): Promise<SupabaseConnectionTestResult | null> {
  const field = step === 'public-key' ? 'public' : 'desktop'

  try {
    const client = createClient(serviceUrl, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await client.from('conferences').select('id').limit(1)

    if (!error) {
      return null
    }

    const failureKind = classifyPostgrestError(error, field)
    const details: SupabaseConnectionProbeDetails = {
      step,
      httpStatus: postgrestHttpStatus(error),
      code: error.code ?? null,
      sanitizedMessage: sanitizeErrorText(error.message),
    }
    logProbe(details)

    return {
      success: false,
      message: messageForFailureKind(failureKind, details),
      failureKind,
      details,
    }
  } catch (error) {
    if (!isNetworkError(error)) {
      const details: SupabaseConnectionProbeDetails = {
        step,
        httpStatus: null,
        code: null,
        sanitizedMessage: sanitizeErrorText(
          error instanceof Error ? error.message : 'Unexpected connection error',
        ),
      }
      logProbe(details)
      return {
        success: false,
        message: messageForFailureKind('permission-schema', details),
        failureKind: 'permission-schema',
        details,
      }
    }

    const details: SupabaseConnectionProbeDetails = {
      step: 'url',
      httpStatus: null,
      code: null,
      sanitizedMessage: sanitizeErrorText(error instanceof Error ? error.message : 'Network error'),
    }
    logProbe(details)
    return {
      success: false,
      message: messageForFailureKind('network', details),
      failureKind: 'network',
      details,
    }
  }
}

export async function testSupabaseConnection(
  serviceUrl: string,
  publicKey: string,
  desktopConnectionKey: string,
): Promise<SupabaseConnectionTestResult> {
  const trimmedUrl = serviceUrl.trim()
  const trimmedPublic = publicKey.trim()
  const trimmedDesktop = desktopConnectionKey.trim()

  const urlError = validateServiceUrl(trimmedUrl)
  if (urlError) {
    const details: SupabaseConnectionProbeDetails = {
      step: 'url',
      httpStatus: null,
      code: null,
      sanitizedMessage: urlError,
    }
    logProbe(details)
    return {
      success: false,
      message: urlError,
      failureKind: 'invalid-url',
      details,
    }
  }

  const publicKeyMismatch = validateKeyForField(trimmedPublic, 'public')
  if (publicKeyMismatch) {
    return {
      success: false,
      message: messageForFailureKind(publicKeyMismatch, null),
      failureKind: publicKeyMismatch,
      details: null,
    }
  }

  const desktopKeyMismatch = validateKeyForField(trimmedDesktop, 'desktop')
  if (desktopKeyMismatch) {
    return {
      success: false,
      message: messageForFailureKind(desktopKeyMismatch, null),
      failureKind: desktopKeyMismatch,
      details: null,
    }
  }

  const publicProbe = await probeTableAccess(trimmedUrl, trimmedPublic, 'public-key')
  if (publicProbe) {
    return publicProbe
  }

  const desktopProbe = await probeTableAccess(trimmedUrl, trimmedDesktop, 'desktop-key')
  if (desktopProbe) {
    return desktopProbe
  }

  return {
    success: true,
    message: null,
    failureKind: null,
    details: null,
  }
}
