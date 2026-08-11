import crypto from 'node:crypto'
import type { PairingInfo, PairingStatus } from '../../src/shared/models/PairingInfo'
import {
  buildScannerPairingUrl,
  pairingBlockMessage,
  pairingPublishWarningMessage,
} from '../../src/shared/pairing/pairingMessages'
import { PAIRING_TOKEN_TTL_MINUTES } from '../config/appDefaults'
import { ensureConferenceId } from '../cloud/conferenceRepository'
import { resolveDesktopCloudOpsTransport } from '../cloud/cloudOpsTransport'
import {
  createPairingViaDesk,
  getPairingStatusViaDesk,
  hashPairingToken,
} from '../cloud/desktopCloudApi'
import {
  getCloudPublishState,
} from '../cloud/cloudPublishStore'
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

function failedPairing(error: string): PairingInfo {
  return {
    ready: false,
    pairingUrl: null,
    expiresAt: null,
    tokenId: null,
    phoneConnected: false,
    error,
    warning: null,
  }
}

/**
 * Best-effort publish so phones get attendees. Hard-fails only when there is
 * nothing useful to publish; publish glitches become a soft warning so one-scan
 * pairing can still proceed on an enrolled desk.
 */
async function prepareAttendeesForPairing(): Promise<{
  hardError: string | null
  warning: string | null
}> {
  if (!isAttendeeCacheLoaded() || getAttendeeCache().length === 0) {
    const loadResult = await loadRegFoxAttendees()
    if (!loadResult.success || getAttendeeCache().length === 0) {
      return {
        hardError: pairingBlockMessage('no_attendees'),
        warning: null,
      }
    }
  }

  const publishResult = await publishAttendees()
  if (publishResult.success) {
    return { hardError: null, warning: null }
  }

  const publishState = await getCloudPublishState()
  if (publishState.lastPublishAt && getAttendeeCache().length > 0) {
    return {
      hardError: null,
      warning: pairingPublishWarningMessage(),
    }
  }

  return {
    hardError: null,
    warning: pairingPublishWarningMessage(),
  }
}

export async function createScannerPairing(): Promise<PairingInfo> {
  const cloudStatus = await getCloudStatus()
  const scannerWebAddress = getScannerWebAddress()
  const transport = resolveDesktopCloudOpsTransport()

  if (transport === 'none' || !cloudStatus.configured) {
    return failedPairing(pairingBlockMessage('not_enrolled'))
  }

  if (!cloudStatus.connected) {
    return failedPairing(pairingBlockMessage('not_enrolled'))
  }

  if (!scannerWebAddress || !isHttpsUrl(scannerWebAddress)) {
    return failedPairing(pairingBlockMessage('scanner_url_missing'))
  }

  const attendeePrep = await prepareAttendeesForPairing()
  if (attendeePrep.hardError) {
    return failedPairing(attendeePrep.hardError)
  }

  let conferenceId: string
  try {
    conferenceId = await ensureConferenceId()
  } catch {
    return failedPairing(pairingBlockMessage('not_enrolled'))
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
        return failedPairing(pairingBlockMessage('not_enrolled'))
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
        return failedPairing(pairingBlockMessage('token_create_failed'))
      }

      tokenId = data.id as string
    }

    return {
      ready: true,
      pairingUrl: buildScannerPairingUrl(scannerWebAddress, rawToken),
      expiresAt,
      tokenId,
      phoneConnected: false,
      error: null,
      warning: attendeePrep.warning,
    }
  } catch {
    return failedPairing(pairingBlockMessage('token_create_failed'))
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
