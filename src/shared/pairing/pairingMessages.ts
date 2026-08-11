/**
 * Pure helpers for one-scan phone pairing (Sprint 21.7).
 * QR payload is an HTTPS scanner URL with a short-lived token only.
 */

export function buildScannerPairingUrl(scannerOrigin: string, rawToken: string): string {
  const origin = scannerOrigin.trim().replace(/\/+$/, '')
  const token = rawToken.trim()
  if (!origin || !token) {
    throw new Error('Scanner origin and pairing token are required.')
  }

  return `${origin}/pair?token=${encodeURIComponent(token)}`
}

export type PairingBlockReason =
  | 'not_enrolled'
  | 'scanner_url_missing'
  | 'no_attendees'
  | 'token_create_failed'
  | 'unknown'

/**
 * Organizer-facing copy — no Cloud/URL/key jargon for normal conference use.
 */
export function pairingBlockMessage(reason: PairingBlockReason): string {
  switch (reason) {
    case 'not_enrolled':
      return 'This computer is not connected to the conference yet. Ask your setup person to enroll it with the one-time conference code, then try again. Desktop registration is still available.'
    case 'scanner_url_missing':
      return 'Phone scanning is not set up for this install yet. Ask your FoxBridge setup person to finish phone setup, then try again. Desktop registration is still available.'
    case 'no_attendees':
      return 'No attendees are loaded yet. Connect registration and wait for attendees, then try again.'
    case 'token_create_failed':
      return 'Unable to create a phone code right now. Try again in a moment. Desktop registration is still available.'
    default:
      return 'Phone scanning is not available right now. Desktop registration is still available.'
  }
}

export function pairingPublishWarningMessage(): string {
  return 'Phones may not have the latest attendee list yet. You can still connect a phone; refresh registrations if scanners look out of date.'
}
