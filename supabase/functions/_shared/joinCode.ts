/**
 * Sprint 22.5 — Linked join-code + installation helpers for Edge Functions.
 * Keep in sync with src/shared/cloud/deskCredentialPolicy.ts canonicalizeJoinCode.
 */

/** Canonical form matching issue_desk_join_code raw_code (XXXX-XXXX-XXXX). */
export function canonicalizeJoinCode(raw: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/[\s\-]+/g, '')
  if (!/^[0-9A-F]{12}$/.test(compact)) {
    return null
  }
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`
}

export function isFoxBridgeInstallationId(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}
