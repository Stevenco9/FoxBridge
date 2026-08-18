/**
 * Product-level FoxBridge Cloud configuration (implementation-agnostic).
 *
 * Supabase is the current backend. Prefer these types in product-facing code
 * over vendor field names.
 */

export type CloudConfigSource = 'settings' | 'packaged_default' | 'env' | 'none'

export type CloudPrivilegedCredentialSource = 'secrets' | 'env' | 'none'

/** Non-secret client configuration for FoxBridge Cloud / Sync. */
export interface FoxBridgeCloudPublicConfig {
  cloudUrl: string
  /** Publishable client key (e.g. Supabase anon key). Never a service-role secret. */
  publishableKey: string
  source: Exclude<CloudConfigSource, 'none'>
}

export interface FoxBridgeCloudPrivilegedCredentials {
  /** Privileged desktop/server key (e.g. service role). Never packaged into builds. */
  privilegedKey: string
  source: Exclude<CloudPrivilegedCredentialSource, 'none'>
}

/** Effective Cloud connection for privileged Desktop main-process operations. */
export interface FoxBridgeCloudConnectionConfig {
  cloudUrl: string
  publishableKey: string
  privilegedKey: string
  publicSource: Exclude<CloudConfigSource, 'none'>
  privilegedSource: Exclude<CloudPrivilegedCredentialSource, 'none'>
}

export interface FoxBridgeCloudConfigInfo {
  cloudUrl: string | null
  /** Publishable client key when resolved; never a privileged secret. */
  publishableKey: string | null
  scannerWebAddress: string | null
  publicSource: CloudConfigSource
  /** Legacy local service-role / privileged key is present. */
  privilegedConfigured: boolean
  privilegedSource: CloudPrivilegedCredentialSource
  /**
   * True when Desktop can run FoxBridge Cloud ops via desk credential
   * (production) or legacy privileged key (dev/migration).
   */
  readyForPrivilegedDesktopOps: boolean
  /** Event-scoped desk device credential is stored locally. */
  deskCredentialConfigured: boolean
  cloudOpsTransport: 'desk_credential' | 'legacy_service_role' | 'none'
}

export interface ResolveCloudPublicConfigInput {
  settingsUrl: string | null | undefined
  settingsPublishableKey: string | null | undefined
  packagedUrl: string | null | undefined
  packagedPublishableKey: string | null | undefined
  envUrl: string | null | undefined
  envPublishableKey: string | null | undefined
}

export interface ResolveCloudPrivilegedKeyInput {
  secretsPrivilegedKey: string | null | undefined
  envPrivilegedKey: string | null | undefined
}

/** Safe shape of public Cloud resolution — never includes URL or key values. */
export interface CloudPublicConfigDiagnostic {
  source: CloudConfigSource
  settingsUrlPresent: boolean
  settingsKeyPresent: boolean
  packagedUrlPresent: boolean
  packagedKeyPresent: boolean
  envUrlPresent: boolean
  envKeyPresent: boolean
  settingsUrlLength: number
  settingsKeyLength: number
  packagedUrlLength: number
  packagedKeyLength: number
  envUrlLength: number
  envKeyLength: number
  /** True when packaged URL+key are both present but source is still none. */
  packagedPresentButUnresolved: boolean
}

export interface CloudPublicConfigInspection {
  config: FoxBridgeCloudPublicConfig | null
  diagnostic: CloudPublicConfigDiagnostic
}

export const MISSING_PUBLIC_CLOUD_CONFIG_MESSAGE =
  'FoxBridge Cloud public configuration is missing.'

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function presence(value: string | null): { present: boolean; length: number } {
  return {
    present: Boolean(value),
    length: value?.length ?? 0,
  }
}

/**
 * Resolve public Cloud config and a secret-free diagnostic from the same trimmed
 * inputs. Precedence is unchanged: complete settings → packaged defaults → env.
 */
export function inspectCloudPublicConfig(
  input: ResolveCloudPublicConfigInput,
): CloudPublicConfigInspection {
  const settingsUrl = trimOrNull(input.settingsUrl)
  const settingsKey = trimOrNull(input.settingsPublishableKey)
  const packagedUrl = trimOrNull(input.packagedUrl)
  const packagedKey = trimOrNull(input.packagedPublishableKey)
  const envUrl = trimOrNull(input.envUrl)
  const envKey = trimOrNull(input.envPublishableKey)

  let config: FoxBridgeCloudPublicConfig | null = null
  if (settingsUrl && settingsKey) {
    config = {
      cloudUrl: settingsUrl,
      publishableKey: settingsKey,
      source: 'settings',
    }
  } else if (packagedUrl && packagedKey) {
    config = {
      cloudUrl: packagedUrl,
      publishableKey: packagedKey,
      source: 'packaged_default',
    }
  } else if (envUrl && envKey) {
    config = {
      cloudUrl: envUrl,
      publishableKey: envKey,
      source: 'env',
    }
  }

  const settingsUrlShape = presence(settingsUrl)
  const settingsKeyShape = presence(settingsKey)
  const packagedUrlShape = presence(packagedUrl)
  const packagedKeyShape = presence(packagedKey)
  const envUrlShape = presence(envUrl)
  const envKeyShape = presence(envKey)
  const source: CloudConfigSource = config?.source ?? 'none'

  return {
    config,
    diagnostic: {
      source,
      settingsUrlPresent: settingsUrlShape.present,
      settingsKeyPresent: settingsKeyShape.present,
      packagedUrlPresent: packagedUrlShape.present,
      packagedKeyPresent: packagedKeyShape.present,
      envUrlPresent: envUrlShape.present,
      envKeyPresent: envKeyShape.present,
      settingsUrlLength: settingsUrlShape.length,
      settingsKeyLength: settingsKeyShape.length,
      packagedUrlLength: packagedUrlShape.length,
      packagedKeyLength: packagedKeyShape.length,
      envUrlLength: envUrlShape.length,
      envKeyLength: envKeyShape.length,
      packagedPresentButUnresolved:
        source === 'none' && packagedUrlShape.present && packagedKeyShape.present,
    },
  }
}

const DIAGNOSTIC_LOG_KEYS = [
  'source',
  'settingsUrlPresent',
  'settingsKeyPresent',
  'packagedUrlPresent',
  'packagedKeyPresent',
  'envUrlPresent',
  'envKeyPresent',
  'settingsUrlLength',
  'settingsKeyLength',
  'packagedUrlLength',
  'packagedKeyLength',
  'envUrlLength',
  'envKeyLength',
  'packagedPresentButUnresolved',
] as const

/** One-line main-process log. Whitelists diagnostic fields only — never URL/key values. */
export function formatCloudPublicConfigDiagnosticLog(
  diagnostic: CloudPublicConfigDiagnostic,
): string {
  const safe: Record<string, string | boolean | number> = {}
  for (const key of DIAGNOSTIC_LOG_KEYS) {
    safe[key] = diagnostic[key]
  }
  return `[cloud-config] resolve ${JSON.stringify(safe)}`
}

/**
 * Resolve non-secret Cloud endpoint + publishable key.
 * Precedence: explicit settings → packaged defaults → local env.
 */
export function resolveCloudPublicConfig(
  input: ResolveCloudPublicConfigInput,
): FoxBridgeCloudPublicConfig | null {
  return inspectCloudPublicConfig(input).config
}

/** Returns the resolved public pair, or throws the production missing-config error. */
export function takeResolvedPublicConfig(
  inspection: CloudPublicConfigInspection,
): { cloudUrl: string; publishableKey: string } {
  if (inspection.config && inspection.diagnostic.source !== 'none') {
    return {
      cloudUrl: inspection.config.cloudUrl.replace(/\/+$/, ''),
      publishableKey: inspection.config.publishableKey,
    }
  }
  throw new Error(MISSING_PUBLIC_CLOUD_CONFIG_MESSAGE)
}

/**
 * Resolve privileged Desktop Cloud credentials.
 * Never accepts packaged defaults — secrets must come from local secure
 * storage (migration) or developer env only.
 */
export function resolveCloudPrivilegedCredentials(
  input: ResolveCloudPrivilegedKeyInput,
): FoxBridgeCloudPrivilegedCredentials | null {
  const fromSecrets = trimOrNull(input.secretsPrivilegedKey)
  if (fromSecrets) {
    return { privilegedKey: fromSecrets, source: 'secrets' }
  }

  const fromEnv = trimOrNull(input.envPrivilegedKey)
  if (fromEnv) {
    return { privilegedKey: fromEnv, source: 'env' }
  }

  return null
}

export function resolveCloudConnectionConfig(input: {
  publicConfig: FoxBridgeCloudPublicConfig | null
  privileged: FoxBridgeCloudPrivilegedCredentials | null
}): FoxBridgeCloudConnectionConfig | null {
  if (!input.publicConfig || !input.privileged) {
    return null
  }

  return {
    cloudUrl: input.publicConfig.cloudUrl,
    publishableKey: input.publicConfig.publishableKey,
    privilegedKey: input.privileged.privilegedKey,
    publicSource: input.publicConfig.source,
    privilegedSource: input.privileged.source,
  }
}
