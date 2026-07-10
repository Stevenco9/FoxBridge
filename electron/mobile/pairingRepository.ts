import crypto from 'node:crypto'
import type { PairingInfo, PairingStatus } from '../../src/shared/models/PairingInfo'
import { PAIRING_TOKEN_TTL_MINUTES } from '../config/appDefaults'
import { getCloudStatus, publishAttendees } from '../cloud/publishAttendeesRepository'
import { loadSupabaseConfig, getScannerWebAddress } from '../cloud/supabaseConfig'
import { getSupabaseServiceClient } from '../cloud/supabaseClient'
import { isAttendeeCacheLoaded, getAttendeeCache } from '../scannerServer/attendeeCache'
import { loadRegFoxAttendees } from '../settings/settingsService'

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

async function ensureAttendeesPublished(): Promise<string | null> {
  const cloudStatus = await getCloudStatus()
  if (!cloudStatus.configured || !cloudStatus.connected) {
    return 'Phone scanners are not connected yet. Desktop registration is still available.'
  }

  if (!isAttendeeCacheLoaded() || getAttendeeCache().length === 0) {
    const loadResult = await loadRegFoxAttendees()
    if (!loadResult.success) {
      return loadResult.message ?? 'Unable to load attendees before pairing.'
    }
  }

  const publishResult = await publishAttendees()
  if (!publishResult.success) {
    return 'Phone scanners could not be updated. Desktop registration is still available.'
  }

  return null
}

export async function createScannerPairing(): Promise<PairingInfo> {
  const cloudStatus = await getCloudStatus()
  const scannerWebAddress = getScannerWebAddress()

  if (!cloudStatus.configured || !cloudStatus.connected) {
    return {
      ready: false,
      pairingUrl: null,
      expiresAt: null,
      tokenId: null,
      phoneConnected: false,
      error: 'Phone scanning is not connected yet. Desktop registration is still available.',
    }
  }

  if (!scannerWebAddress || !isHttpsUrl(scannerWebAddress)) {
    return {
      ready: false,
      pairingUrl: null,
      expiresAt: null,
      tokenId: null,
      phoneConnected: false,
      error:
        'A scanner web address is not set up yet. Add it under Settings → Advanced if phone scanning is needed.',
    }
  }

  const publishWarning = await ensureAttendeesPublished()
  if (publishWarning) {
    return {
      ready: false,
      pairingUrl: null,
      expiresAt: null,
      tokenId: null,
      phoneConnected: false,
      error: publishWarning,
    }
  }

  const config = loadSupabaseConfig()
  const client = getSupabaseServiceClient()
  if (!config || !client) {
    return {
      ready: false,
      pairingUrl: null,
      expiresAt: null,
      tokenId: null,
      phoneConnected: false,
      error: 'Phone scanning is not connected yet. Desktop registration is still available.',
    }
  }

  const rawToken = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + PAIRING_TOKEN_TTL_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await client
    .from('scanner_pairing_tokens')
    .insert({
      conference_id: config.conferenceId,
      token_hash: tokenHash,
      role: 'meal_scanner',
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error || !data) {
    return {
      ready: false,
      pairingUrl: null,
      expiresAt: null,
      tokenId: null,
      phoneConnected: false,
      error: 'Unable to create a pairing code right now. Try again.',
    }
  }

  const pairingUrl = `${scannerWebAddress.replace(/\/+$/, '')}/pair?token=${encodeURIComponent(rawToken)}`

  return {
    ready: true,
    pairingUrl,
    expiresAt,
    tokenId: data.id as string,
    phoneConnected: false,
    error: null,
  }
}

export async function getPairingStatus(tokenId: string): Promise<PairingStatus> {
  const client = getSupabaseServiceClient()
  if (!client || !tokenId) {
    return { used: false, usedAt: null }
  }

  const { data, error } = await client
    .from('scanner_pairing_tokens')
    .select('used_at')
    .eq('id', tokenId)
    .maybeSingle()

  if (error || !data) {
    return { used: false, usedAt: null }
  }

  const usedAt = (data.used_at as string | null) ?? null
  return {
    used: Boolean(usedAt),
    usedAt,
  }
}
