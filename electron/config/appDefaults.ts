/**
 * Packaged product defaults (non-secret only).
 *
 * Populate at packaging/CI via environment variables — leave empty in the
 * open repo so source is not tied to a single backend project:
 *
 * - FOXBRIDGE_CLOUD_URL
 * - FOXBRIDGE_CLOUD_PUBLISHABLE_KEY (preferred) or FOXBRIDGE_CLOUD_ANON_KEY
 * - FOXBRIDGE_SCANNER_URL / MOBILE_APP_URL (scanner HTTPS origin)
 *
 * Never put a service-role or other privileged secret in these defaults,
 * even for Electron main-process consumption.
 */

export const DEFAULT_FOXBRIDGE_CLOUD_URL =
  process.env.FOXBRIDGE_CLOUD_URL?.trim() || ''

/**
 * Publishable/public client key for FoxBridge Cloud (e.g. anon key).
 * Not a privileged desktop/server credential.
 */
export const DEFAULT_FOXBRIDGE_CLOUD_PUBLISHABLE_KEY =
  process.env.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY?.trim() ||
  process.env.FOXBRIDGE_CLOUD_ANON_KEY?.trim() ||
  ''

/**
 * Packaged defaults for AdAgrA production builds.
 * Override via MOBILE_APP_URL / FOXBRIDGE_SCANNER_URL in .env or Settings → Advanced.
 */
export const DEFAULT_SCANNER_WEB_ADDRESS =
  process.env.FOXBRIDGE_SCANNER_URL?.trim() ||
  process.env.MOBILE_APP_URL?.trim() ||
  ''

export const PAIRING_TOKEN_TTL_MINUTES = 10

export function getPackagedCloudPublicDefaults(): {
  cloudUrl: string
  publishableKey: string
} {
  return {
    cloudUrl: DEFAULT_FOXBRIDGE_CLOUD_URL,
    publishableKey: DEFAULT_FOXBRIDGE_CLOUD_PUBLISHABLE_KEY,
  }
}
