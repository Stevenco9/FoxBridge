import crypto from 'node:crypto'
import type { PairingInfo, PairingStatus } from '../../src/shared/models/PairingInfo'
import { PAIRING_TOKEN_TTL_MINUTES } from '../config/appDefaults'
import { ensureConferenceId } from '../cloud/conferenceRepository'
import { resolveDesktopCloudOpsTransport } from '../cloud/cloudOpsTransport'
import {
  createPairingViaDesk,
  getPairingStatusViaDesk,
  hashPairingToken,
} from '../cloud/desktopCloudApi'
import { getCloudStatus, publishAttendees } from '../cloud/publishAttendeesRepository'
import { getScannerWebAddress } from '../cloud/supabaseConfig'
import { getSupabaseServiceClient } from '../cloud/supabaseClient'
import { isAttendeeCacheLoaded, getAttendeeCache } from '../scannerServer/attendeeCache'
import { loadRegFoxAttendees } from '../settings/settingsService'

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
  const transport = resolveDesktopCloudOpsTransport()

  if (!cloudStatus.configured || !cloudStatus.connected || transport === 'none') {
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

  let conferenceId: string
  try {
    conferenceId = await ensureConferenceId()
  } catch {
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
  const tokenHash = hashPairingToken(rawToken)
  const expiresAt = new Date(Date.now() + PAIRING_TOKEN_TTL_MINUTES * 60 * 1000).toISOString()

  try {
    let tokenId: string

    if (transport === 'desk_credential') {
      const created = await createPairingViaDesk({ tokenHash, expiresAt })
      tokenId = created.tokenId
    } else {
      const client = getSupabaseServiceClient()
      if (!client) {
        return {
          ready: false,
          pairingUrl: null,
          expiresAt: null,
          tokenId: null,
          phoneConnected: false,
          error: 'Phone scanning is not connected yet. Desktop registration is still available.',
        }
      }

      const { data, error } = await client
        .from('scanner_pairing_tokens')
        .insert({
          conference_id: conferenceId,
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

      tokenId = data.id as string
    }

    const pairingUrl = `${scannerWebAddress.replace(/\/+$/, '')}/pair?token=${encodeURIComponent(rawToken)}`

    return {
      ready: true,
      pairingUrl,
      expiresAt,
      tokenId,
      phoneConnected: false,
      error: null,
    }
  } catch {
    return {
      ready: false,
      pairingUrl: null,
      expiresAt: null,
      tokenId: null,
      phoneConnected: false,
      error: 'Unable to create a pairing code right now. Try again.',
    }
  }
}

export async function getPairingStatus(tokenId: string): Promise<PairingStatus> {
  if (!tokenId) {
    return { used: false, usedAt: null }
  }

  const transport = resolveDesktopCloudOpsTransport()
  try {
    if (transport === 'desk_credential') {
      return await getPairingStatusViaDesk(tokenId)
    }

    const client = getSupabaseServiceClient()
    if (!client) {
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
  } catch {
    return { used: false, usedAt: null }
  }
}
