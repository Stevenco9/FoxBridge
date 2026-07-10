export interface PairingInfo {
  ready: boolean
  pairingUrl: string | null
  expiresAt: string | null
  tokenId: string | null
  phoneConnected: boolean
  error: string | null
}

export interface PairingStatus {
  used: boolean
  usedAt: string | null
}
