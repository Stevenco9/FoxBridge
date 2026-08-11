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
  privilegedConfigured: boolean
  privilegedSource: CloudPrivilegedCredentialSource
  /** True when Desktop can run privileged Cloud operations today (publish, etc.). */
  readyForPrivilegedDesktopOps: boolean
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

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Resolve non-secret Cloud endpoint + publishable key.
 * Precedence: explicit settings → packaged defaults → local env.
 */
export function resolveCloudPublicConfig(
  input: ResolveCloudPublicConfigInput,
): FoxBridgeCloudPublicConfig | null {
  const settingsUrl = trimOrNull(input.settingsUrl)
  const settingsKey = trimOrNull(input.settingsPublishableKey)
  if (settingsUrl && settingsKey) {
    return {
      cloudUrl: settingsUrl,
      publishableKey: settingsKey,
      source: 'settings',
    }
  }

  const packagedUrl = trimOrNull(input.packagedUrl)
  const packagedKey = trimOrNull(input.packagedPublishableKey)
  if (packagedUrl && packagedKey) {
    return {
      cloudUrl: packagedUrl,
      publishableKey: packagedKey,
      source: 'packaged_default',
    }
  }

  const envUrl = trimOrNull(input.envUrl)
  const envKey = trimOrNull(input.envPublishableKey)
  if (envUrl && envKey) {
    return {
      cloudUrl: envUrl,
      publishableKey: envKey,
      source: 'env',
    }
  }

  return null
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
