import type {
  CloudPublicConfigInspection,
  FoxBridgeCloudConfigInfo,
  FoxBridgeCloudConnectionConfig,
  FoxBridgeCloudPublicConfig,
} from '../../src/shared/models/CloudConfig'
import {
  inspectCloudPublicConfig,
  resolveCloudConnectionConfig,
  resolveCloudPrivilegedCredentials,
} from '../../src/shared/models/CloudConfig'
import { resolveCloudOpsTransport } from '../../src/shared/cloud/deskCredentialPolicy'
import { getPackagedCloudPublicDefaults } from '../config/appDefaults'
import {
  getEnvValueForCloudConfig,
  getMobileAppUrlFromConfig,
  getScannerWebAddressFromConfig,
  readDesktopConnectionKeySync,
  readPublicCloudSettingsSync,
} from './cloudConfigInternals'
import { readDeskCredentialSync } from './deskCredentialStore'

/**
 * FoxBridge Cloud configuration boundary (product-facing).
 *
 * Public (non-secret): settings override → packaged defaults → local env.
 * Production ops auth: event-scoped desk credential (Sprint 21.6).
 * Legacy privileged key: local secrets / developer env only — never packaged.
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

function readPublicConfigResolutionInput() {
  const settings = readPublicCloudSettingsSync()
  const packaged = getPackagedCloudPublicDefaults()
  return {
    settingsUrl: settings.mobileServiceUrl,
    settingsPublishableKey: settings.mobilePublicKey,
    packagedUrl: packaged.cloudUrl,
    packagedPublishableKey: packaged.publishableKey,
    envUrl: envCloudUrl(),
    envPublishableKey: envPublishableKey(),
  }
}

/** Same inputs as resolveFoxBridgeCloudPublicConfig. Diagnostic shape is for tests, not a production log file. */
export function inspectFoxBridgeCloudPublicConfig(): CloudPublicConfigInspection {
  return inspectCloudPublicConfig(readPublicConfigResolutionInput())
}

export function resolveFoxBridgeCloudPublicConfig(): FoxBridgeCloudPublicConfig | null {
  return inspectFoxBridgeCloudPublicConfig().config
}

/** Legacy service-role connection only (dev/migration). Prefer desk credential path. */
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

/** Desktop can perform FoxBridge Cloud ops (desk credential or legacy key). */
export function isFoxBridgeCloudPrivilegedConfigured(): boolean {
  return getFoxBridgeCloudConfigInfo().readyForPrivilegedDesktopOps
}

export function getFoxBridgeCloudConfigInfo(): FoxBridgeCloudConfigInfo {
  const publicConfig = resolveFoxBridgeCloudPublicConfig()
  const privileged = resolveCloudPrivilegedCredentials({
    secretsPrivilegedKey: readDesktopConnectionKeySync(),
    envPrivilegedKey: getEnvValueForCloudConfig('SUPABASE_SERVICE_ROLE_KEY'),
  })
  const desk = readDeskCredentialSync()
  const transport = resolveCloudOpsTransport({
    publicConfigured: Boolean(publicConfig),
    deskTokenPresent: Boolean(desk?.deskToken),
    legacyPrivilegedKeyPresent: Boolean(privileged),
  })

  return {
    cloudUrl: publicConfig?.cloudUrl ?? null,
    publishableKey: publicConfig?.publishableKey ?? null,
    scannerWebAddress: getScannerWebAddressFromConfig(),
    publicSource: publicConfig?.source ?? 'none',
    privilegedConfigured: Boolean(privileged),
    privilegedSource: privileged?.source ?? 'none',
    readyForPrivilegedDesktopOps: transport !== 'none',
    deskCredentialConfigured: Boolean(desk),
    cloudOpsTransport: transport,
  }
}

export type { FoxBridgeCloudConfigInfo }

export { getMobileAppUrlFromConfig, getScannerWebAddressFromConfig }
