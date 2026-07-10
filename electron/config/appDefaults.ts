/**
 * Packaged defaults for AdAgrA production builds.
 * Override via MOBILE_APP_URL / FOXBRIDGE_SCANNER_URL in .env or Settings → Advanced.
 */
export const DEFAULT_SCANNER_WEB_ADDRESS =
  process.env.FOXBRIDGE_SCANNER_URL?.trim() ||
  process.env.MOBILE_APP_URL?.trim() ||
  ''

export const PAIRING_TOKEN_TTL_MINUTES = 10
