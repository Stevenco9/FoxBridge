import type {
  FoxBridgeCloudConfigInfo,
  FoxBridgeCloudConnectionConfig,
  FoxBridgeCloudPublicConfig,
} from '../../src/shared/models/CloudConfig'
import {
  resolveCloudConnectionConfig,
  resolveCloudPrivilegedCredentials,
  resolveCloudPublicConfig,
} from '../../src/shared/models/CloudConfig'
import { getPackagedCloudPublicDefaults } from '../config/appDefaults'
import {
  getEnvValueForCloudConfig,
  getMobileAppUrlFromConfig,
  getScannerWebAddressFromConfig,
  readDesktopConnectionKeySync,
  readPublicCloudSettingsSync,
} from './cloudConfigInternals'

/**
 * FoxBridge Cloud configuration boundary (product-facing).
 *
 * Separates Sync/Cloud concepts from Supabase implementation adapters.
 *
 * Public (non-secret): settings override → packaged defaults → local env.
 * Privileged: local secrets or developer env only — never packaged defaults.
 */

function envPublishableKey(): string | null {
  return (
    getEnvValueForCloudConfig('FOXBRIDGE_CLOUD_PUBLISHABLE_KEY') ??
    getEnvValueForCloudConfig('FOXBRIDGE_CLOUD_ANON_KEY') ??
    getEnvValueForCloudConfig('SUPABASE_ANON_KEY')
  )
}

function envCloudUrl(): string | null {
  return (
    getEnvValueForCloudConfig('FOXBRIDGE_CLOUD_URL') ??
    getEnvValueForCloudConfig('SUPABASE_URL')
  )
}

export function resolveFoxBridgeCloudPublicConfig(): FoxBridgeCloudPublicConfig | null {
  const settings = readPublicCloudSettingsSync()
  const packaged = getPackagedCloudPublicDefaults()

  return resolveCloudPublicConfig({
    settingsUrl: settings.mobileServiceUrl,
    settingsPublishableKey: settings.mobilePublicKey,
    packagedUrl: packaged.cloudUrl,
    packagedPublishableKey: packaged.publishableKey,
    envUrl: envCloudUrl(),
    envPublishableKey: envPublishableKey(),
  })
}

export function resolveFoxBridgeCloudConnection(): FoxBridgeCloudConnectionConfig | null {
  const publicConfig = resolveFoxBridgeCloudPublicConfig()
  const privileged = resolveCloudPrivilegedCredentials({
    secretsPrivilegedKey: readDesktopConnectionKeySync(),
    envPrivilegedKey: getEnvValueForCloudConfig('SUPABASE_SERVICE_ROLE_KEY'),
  })

  return resolveCloudConnectionConfig({ publicConfig, privileged })
}

export function isFoxBridgeCloudPublicConfigured(): boolean {
  return resolveFoxBridgeCloudPublicConfig() !== null
}

/** Privileged Desktop Cloud ops (publish, service client) are available. */
export function isFoxBridgeCloudPrivilegedConfigured(): boolean {
  return resolveFoxBridgeCloudConnection() !== null
}

export function getFoxBridgeCloudConfigInfo(): FoxBridgeCloudConfigInfo {
  const publicConfig = resolveFoxBridgeCloudPublicConfig()
  const privileged = resolveCloudPrivilegedCredentials({
    secretsPrivilegedKey: readDesktopConnectionKeySync(),
    envPrivilegedKey: getEnvValueForCloudConfig('SUPABASE_SERVICE_ROLE_KEY'),
  })
  const connection = resolveCloudConnectionConfig({ publicConfig, privileged })

  return {
    cloudUrl: publicConfig?.cloudUrl ?? null,
    publishableKey: publicConfig?.publishableKey ?? null,
    scannerWebAddress: getScannerWebAddressFromConfig(),
    publicSource: publicConfig?.source ?? 'none',
    privilegedConfigured: Boolean(privileged),
    privilegedSource: privileged?.source ?? 'none',
    readyForPrivilegedDesktopOps: connection !== null,
  }
}

export type { FoxBridgeCloudConfigInfo }

export { getMobileAppUrlFromConfig, getScannerWebAddressFromConfig }
