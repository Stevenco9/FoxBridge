/**
 * Supabase implementation adapter for FoxBridge Cloud configuration.
 *
 * Prefer `cloudConfig.ts` in new product code. These helpers preserve the
 * existing Supabase-shaped API used by repositories and clients.
 */

import {
  getMobileAppUrlFromConfig,
  getScannerWebAddressFromConfig,
  resolveFoxBridgeCloudConnection,
  resolveFoxBridgeCloudPublicConfig,
} from './cloudConfig'
import {
  getEnvValueForCloudConfig,
  readPublicCloudSettingsSync,
} from './cloudConfigInternals'

export interface SupabaseConnectionConfig {
  url: string
  serviceRoleKey: string
  anonKey: string
}

export interface SupabaseConfig extends SupabaseConnectionConfig {
  conferenceId: string | null
}

export function loadSupabaseConnectionConfig(): SupabaseConnectionConfig | null {
  const connection = resolveFoxBridgeCloudConnection()
  if (!connection) {
    return null
  }

  return {
    url: connection.cloudUrl,
    serviceRoleKey: connection.privilegedKey,
    anonKey: connection.publishableKey,
  }
}

export function loadSupabaseConfig(): SupabaseConfig | null {
  const connection = loadSupabaseConnectionConfig()
  if (!connection) {
    return null
  }

  const settings = readPublicCloudSettingsSync()

  return {
    ...connection,
    conferenceId:
      settings.conferenceId ?? getEnvValueForCloudConfig('SUPABASE_CONFERENCE_ID'),
  }
}

export function isSupabaseConfigured(): boolean {
  return loadSupabaseConnectionConfig() !== null
}

export function getMobileAppUrl(): string | null {
  return getMobileAppUrlFromConfig()
}

/** @deprecated Use getMobileAppUrl */
export function getMobileScannerUrl(): string | null {
  return getMobileAppUrl()
}

/** HTTPS scanner PWA address used in pairing QR codes. */
export function getScannerWebAddress(): string | null {
  return getScannerWebAddressFromConfig()
}

/** Effective public Cloud URL/key for diagnostics (includes packaged defaults). */
export function loadCloudPublicEndpoint(): {
  url: string
  anonKey: string
  source: string
} | null {
  const publicConfig = resolveFoxBridgeCloudPublicConfig()
  if (!publicConfig) {
    return null
  }

  return {
    url: publicConfig.cloudUrl,
    anonKey: publicConfig.publishableKey,
    source: publicConfig.source,
  }
}
