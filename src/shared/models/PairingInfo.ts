export interface PairingInfo {
  ready: boolean
  /**
   * HTTPS scanner URL with short-lived token only, e.g.
   * `https://scanner.example.com/pair?token=…`
   * Never includes Cloud secrets, desk credentials, or conference ids.
   */
  pairingUrl: string | null
  expiresAt: string | null
  tokenId: string | null
  phoneConnected: boolean
  error: string | null
  /** Soft notice (e.g. publish lag); pairing can still proceed. */
  warning: string | null
}

export interface PairingStatus {
  used: boolean
  usedAt: string | null
}

export interface PairingStatus {
  used: boolean
  usedAt: string | null
}
