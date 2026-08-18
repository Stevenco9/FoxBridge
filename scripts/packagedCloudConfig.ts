/**
 * Shared guards for FoxBridge public Cloud packaging (Sprint 24.4A).
 *
 * These values are intentionally public (URL + publishable/anon key + scanner
 * origin). Never log the publishable key or treat service-role credentials as
 * packaging inputs.
 */

export const PACKAGED_CLOUD_URL_KEY = 'FOXBRIDGE_CLOUD_URL'
export const PACKAGED_CLOUD_PUBLISHABLE_KEY = 'FOXBRIDGE_CLOUD_PUBLISHABLE_KEY'
export const PACKAGED_CLOUD_SCANNER_URL_KEY = 'FOXBRIDGE_SCANNER_URL'

export const PACKAGED_CLOUD_ENV_KEYS = [
  PACKAGED_CLOUD_URL_KEY,
  PACKAGED_CLOUD_PUBLISHABLE_KEY,
  PACKAGED_CLOUD_SCANNER_URL_KEY,
] as const

const PLACEHOLDER_HOST_MARKERS = ['example', 'xyzcompany', 'your-project'] as const
const PLACEHOLDER_KEY_MARKERS = [
  'your_anon',
  'your-anon',
  'placeholder',
  'changeme',
  'example',
] as const

const LIVE_SECRET_KEY_PATTERN = /sb_secret_[A-Za-z0-9_-]{8,}/
const MIN_PUBLISHABLE_KEY_LENGTH = 20

function parseDotEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    if (key) {
      values[key] = value
    }
  }
  return values
}

/**
 * Resolve packaging env the same way Vite does: `.env` file for local builds,
 * `process.env` (GitHub Actions Variables) when the key is present — including
 * empty CI values, which must fail closed rather than falling back to a laptop `.env`.
 */
export function resolvePackagedCloudEnv(
  processEnv: NodeJS.Dict<string>,
  dotEnvContents?: string,
): NodeJS.Dict<string> {
  const fileValues = dotEnvContents ? parseDotEnvFile(dotEnvContents) : {}
  const pick = (key: string): string | undefined => {
    if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
      return processEnv[key]
    }
    return fileValues[key]
  }
  return {
    [PACKAGED_CLOUD_URL_KEY]: pick(PACKAGED_CLOUD_URL_KEY),
    [PACKAGED_CLOUD_PUBLISHABLE_KEY]: pick(PACKAGED_CLOUD_PUBLISHABLE_KEY),
    [PACKAGED_CLOUD_SCANNER_URL_KEY]: pick(PACKAGED_CLOUD_SCANNER_URL_KEY),
  }
}

export interface GuardResult {
  ok: boolean
  message: string
}

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? ''
}

function hostLooksLikePlaceholder(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return PLACEHOLDER_HOST_MARKERS.some((marker) => host.includes(marker))
}

function parseHttpsUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:') {
      return null
    }
    if (!parsed.hostname) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function jwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(payloadJson) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

export function validateHttpsPublicUrl(value: string | undefined, varName: string): GuardResult {
  const trimmed = trimEnv(value)
  if (!trimmed) {
    return { ok: false, message: `${varName} is missing or empty.` }
  }
  const parsed = parseHttpsUrl(trimmed)
  if (!parsed) {
    return { ok: false, message: `${varName} must be an HTTPS URL.` }
  }
  if (hostLooksLikePlaceholder(parsed.hostname)) {
    return { ok: false, message: `${varName} looks like a placeholder value.` }
  }
  return { ok: true, message: '' }
}

export function validatePublishableKey(value: string | undefined, varName: string): GuardResult {
  const trimmed = trimEnv(value)
  if (!trimmed) {
    return { ok: false, message: `${varName} is missing or empty.` }
  }
  if (trimmed.length < MIN_PUBLISHABLE_KEY_LENGTH) {
    return { ok: false, message: `${varName} is too short to be a publishable client key.` }
  }
  if (LIVE_SECRET_KEY_PATTERN.test(trimmed) || trimmed.startsWith('sb_secret_')) {
    return {
      ok: false,
      message: `${varName} looks like a privileged secret key and must not be packaged.`,
    }
  }
  const lower = trimmed.toLowerCase()
  if (PLACEHOLDER_KEY_MARKERS.some((marker) => lower.includes(marker))) {
    return { ok: false, message: `${varName} looks like a placeholder value.` }
  }
  const role = jwtRole(trimmed)
  if (role === 'service_role' || role === 'supabase_admin') {
    return {
      ok: false,
      message: `${varName} looks like a privileged service-role credential and must not be packaged.`,
    }
  }
  return { ok: true, message: '' }
}

export function validatePackagedCloudEnv(env: NodeJS.Dict<string>): {
  ok: boolean
  lines: string[]
} {
  const url = validateHttpsPublicUrl(env[PACKAGED_CLOUD_URL_KEY], PACKAGED_CLOUD_URL_KEY)
  const key = validatePublishableKey(
    env[PACKAGED_CLOUD_PUBLISHABLE_KEY],
    PACKAGED_CLOUD_PUBLISHABLE_KEY,
  )
  const scanner = validateHttpsPublicUrl(
    env[PACKAGED_CLOUD_SCANNER_URL_KEY],
    PACKAGED_CLOUD_SCANNER_URL_KEY,
  )

  const lines: string[] = []
  let ok = true

  if (url.ok) {
    lines.push('PACKAGED CLOUD CONFIG: URL OK')
  } else {
    ok = false
    lines.push(`PACKAGED CLOUD CONFIG: URL INVALID — ${url.message}`)
  }

  if (key.ok) {
    lines.push('PACKAGED CLOUD CONFIG: PUBLISHABLE KEY OK')
  } else {
    ok = false
    lines.push(`PACKAGED CLOUD CONFIG: PUBLISHABLE KEY INVALID — ${key.message}`)
  }

  if (scanner.ok) {
    lines.push('PACKAGED CLOUD CONFIG: SCANNER URL OK')
  } else {
    ok = false
    lines.push(`PACKAGED CLOUD CONFIG: SCANNER URL INVALID — ${scanner.message}`)
  }

  return { ok, lines }
}

export function bundleContainsLiteral(haystack: string, value: string): boolean {
  const trimmed = trimEnv(value)
  if (!trimmed) {
    return false
  }
  return haystack.includes(trimmed)
}

export function findCompiledPrivilegedCloudKey(haystack: string): string | null {
  if (LIVE_SECRET_KEY_PATTERN.test(haystack)) {
    return 'sb_secret_'
  }
  return null
}

export function verifyCompiledPackagedCloudBundle(
  bundleText: string,
  env: NodeJS.Dict<string>,
): { ok: boolean; lines: string[] } {
  const envResult = validatePackagedCloudEnv(env)
  if (!envResult.ok) {
    return envResult
  }

  const lines: string[] = []
  let ok = true

  const url = trimEnv(env[PACKAGED_CLOUD_URL_KEY])
  const key = trimEnv(env[PACKAGED_CLOUD_PUBLISHABLE_KEY])
  const scanner = trimEnv(env[PACKAGED_CLOUD_SCANNER_URL_KEY])

  if (bundleContainsLiteral(bundleText, url)) {
    lines.push('PACKAGED CLOUD BUNDLE: URL OK')
  } else {
    ok = false
    lines.push(
      `PACKAGED CLOUD BUNDLE: URL MISSING — compiled dist-electron does not contain ${PACKAGED_CLOUD_URL_KEY}.`,
    )
  }

  if (bundleContainsLiteral(bundleText, key)) {
    lines.push('PACKAGED CLOUD BUNDLE: PUBLISHABLE KEY OK')
  } else {
    ok = false
    lines.push(
      `PACKAGED CLOUD BUNDLE: PUBLISHABLE KEY MISSING — compiled dist-electron does not contain ${PACKAGED_CLOUD_PUBLISHABLE_KEY}.`,
    )
  }

  if (bundleContainsLiteral(bundleText, scanner)) {
    lines.push('PACKAGED CLOUD BUNDLE: SCANNER URL OK')
  } else {
    ok = false
    lines.push(
      `PACKAGED CLOUD BUNDLE: SCANNER URL MISSING — compiled dist-electron does not contain ${PACKAGED_CLOUD_SCANNER_URL_KEY}.`,
    )
  }

  const privileged = findCompiledPrivilegedCloudKey(bundleText)
  if (privileged) {
    ok = false
    lines.push(
      `PACKAGED CLOUD BUNDLE: PRIVILEGED KEY DETECTED — compiled output must not contain ${privileged} credentials.`,
    )
  } else {
    lines.push('PACKAGED CLOUD BUNDLE: NO PRIVILEGED KEYS')
  }

  return { ok, lines }
}
