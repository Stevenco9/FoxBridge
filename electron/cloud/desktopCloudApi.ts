import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { canonicalizeJoinCode, normalizeEnrollmentCode } from '../../src/shared/cloud/deskCredentialPolicy'
import { readOrCreateInstallationIdSync } from './installationIdStore'
import { resolveFoxBridgeCloudPublicConfig } from './cloudConfig'
import { readDeskCredentialSync, type StoredDeskCredential } from './deskCredentialStore'
import { patchSecrets } from '../settings/secretStore'
import { patchPublicSettings } from '../settings/settingsStore'

export interface DesktopEnrollResult {
  success: boolean
  conferenceId: string | null
  conferenceName: string | null
  message: string | null
}

function requirePublicConfig(): { cloudUrl: string; publishableKey: string } {
  const publicConfig = resolveFoxBridgeCloudPublicConfig()
  if (!publicConfig) {
    throw new Error('FoxBridge Cloud public configuration is missing.')
  }
  return {
    cloudUrl: publicConfig.cloudUrl.replace(/\/+$/, ''),
    publishableKey: publicConfig.publishableKey,
  }
}

function requireDeskCredential(): StoredDeskCredential {
  const desk = readDeskCredentialSync()
  if (!desk) {
    throw new Error('This computer is not enrolled for FoxBridge Cloud yet.')
  }
  return desk
}

async function invokeDesktopFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  deskToken?: string,
): Promise<T> {
  const { cloudUrl, publishableKey } = requirePublicConfig()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
  }
  if (deskToken) {
    headers['x-foxbridge-desk-token'] = deskToken
  }

  const response = await fetch(`${cloudUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
  } & T

  if (!response.ok) {
    throw new Error(payload.error || `FoxBridge Cloud request failed (${response.status}).`)
  }

  return payload
}

export async function enrollDesktopWithCode(
  enrollmentCode: string,
  label?: string | null,
): Promise<DesktopEnrollResult> {
  try {
    const code = normalizeEnrollmentCode(enrollmentCode)
    if (!code) {
      return {
        success: false,
        conferenceId: null,
        conferenceName: null,
        message: 'Enter a FoxBridge Cloud enrollment code.',
      }
    }

    const result = await invokeDesktopFunction<{
      deskToken: string
      deskDeviceId: string
      conferenceId: string
      conferenceName: string | null
      regfoxEventId: string | null
    }>('desktop-enroll', {
      enrollmentCode: code,
      label: label?.trim() || null,
    })

    await patchSecrets({
      foxbridgeDeskToken: result.deskToken,
      foxbridgeDeskDeviceId: result.deskDeviceId,
      foxbridgeDeskConferenceId: result.conferenceId,
      foxbridgeDeskRole: 'legacy',
      foxbridgeDeskExpiresAt: null,
    })

    await patchPublicSettings({
      conferenceId: result.conferenceId,
      conferenceName: result.conferenceName,
      ...(result.regfoxEventId ? { regfoxEventId: result.regfoxEventId } : {}),
    })

    return {
      success: true,
      conferenceId: result.conferenceId,
      conferenceName: result.conferenceName,
      message: null,
    }
  } catch (error) {
    return {
      success: false,
      conferenceId: null,
      conferenceName: null,
      message:
        error instanceof Error ? error.message : 'Unable to enroll this computer.',
    }
  }
}

export interface PrincipalClaimResult {
  success: boolean
  conferenceId: string | null
  conferenceName: string | null
  transferred: boolean
  needsTransferConfirmation: boolean
  message: string | null
}

/**
 * Sprint 22.1/22.4 — claim Principal Desktop using RegFox ownership credentials.
 * Sends the API key only to the trusted Edge Function over HTTPS; never logs it.
 * Does not send desk tokens (Linked possession must not participate in claim).
 * When another Principal exists, returns needsTransferConfirmation unless confirmTransfer.
 */
export async function claimPrincipalDesktopWithRegFox(input: {
  regfoxApiKey: string
  externalEventId: string
  label?: string | null
  confirmTransfer?: boolean
}): Promise<PrincipalClaimResult> {
  const apiKey = input.regfoxApiKey.trim()
  const externalEventId = input.externalEventId.trim()

  if (!apiKey || !externalEventId) {
    return {
      success: false,
      conferenceId: null,
      conferenceName: null,
      transferred: false,
      needsTransferConfirmation: false,
      message: 'Connect RegFox before setting up FoxBridge Sync.',
    }
  }

  try {
    const { cloudUrl, publishableKey } = requirePublicConfig()
    const response = await fetch(`${cloudUrl}/functions/v1/desktop-claim-principal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      body: JSON.stringify({
        registrationPlatform: 'regfox',
        externalEventId,
        regfoxApiKey: apiKey,
        label: input.label?.trim() || null,
        confirmTransfer: input.confirmTransfer === true,
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      needsTransferConfirmation?: boolean
      deskToken?: string
      deskDeviceId?: string
      conferenceId?: string
      conferenceName?: string | null
      regfoxEventId?: string | null
      transferred?: boolean
      role?: string
    }

    if (response.status === 409 && payload.needsTransferConfirmation) {
      return {
        success: false,
        conferenceId: payload.conferenceId ?? null,
        conferenceName: payload.conferenceName ?? null,
        transferred: false,
        needsTransferConfirmation: true,
        message:
          payload.error ||
          'Another computer is already the Principal for this event. Confirm to transfer.',
      }
    }

    if (!response.ok) {
      return {
        success: false,
        conferenceId: null,
        conferenceName: null,
        transferred: false,
        needsTransferConfirmation: false,
        message: payload.error || `FoxBridge Cloud request failed (${response.status}).`,
      }
    }

    if (!payload.deskToken || !payload.deskDeviceId || !payload.conferenceId) {
      return {
        success: false,
        conferenceId: null,
        conferenceName: null,
        transferred: false,
        needsTransferConfirmation: false,
        message: 'FoxBridge Cloud did not return a desk credential.',
      }
    }

    await patchSecrets({
      foxbridgeDeskToken: payload.deskToken,
      foxbridgeDeskDeviceId: payload.deskDeviceId,
      foxbridgeDeskConferenceId: payload.conferenceId,
      foxbridgeDeskRole: 'principal',
      foxbridgeDeskExpiresAt: null,
    })

    await patchPublicSettings({
      conferenceId: payload.conferenceId,
      conferenceName: payload.conferenceName ?? null,
      regfoxEventId: payload.regfoxEventId ?? externalEventId,
    })

    return {
      success: true,
      conferenceId: payload.conferenceId,
      conferenceName: payload.conferenceName ?? null,
      transferred: Boolean(payload.transferred),
      needsTransferConfirmation: false,
      message: null,
    }
  } catch (error) {
    return {
      success: false,
      conferenceId: null,
      conferenceName: null,
      transferred: false,
      needsTransferConfirmation: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to connect FoxBridge Sync right now.',
    }
  }
}

export async function resolveConferenceViaDesk(input?: {
  regfoxEventId?: string | null
}): Promise<{
  id: string
  name: string
  deskRole: string | null
  deskExpiresAt: string | null
}> {
  const desk = requireDeskCredential()
  const result = await invokeDesktopFunction<{
    conferenceId: string
    conferenceName: string
    deskRole?: string
    deskExpiresAt?: string | null
  }>(
    'desktop-resolve-conference',
    {
      conferenceId: desk.conferenceId,
      regfoxEventId: input?.regfoxEventId ?? null,
    },
    desk.deskToken,
  )

  const secretPatch: {
    foxbridgeDeskRole?: string
    foxbridgeDeskExpiresAt?: string | null
  } = {}
  if (result.deskRole === 'principal' || result.deskRole === 'linked' || result.deskRole === 'legacy') {
    secretPatch.foxbridgeDeskRole = result.deskRole
  }
  if (result.deskExpiresAt !== undefined) {
    secretPatch.foxbridgeDeskExpiresAt = result.deskExpiresAt
  } else if (result.deskRole === 'principal' || result.deskRole === 'legacy') {
    secretPatch.foxbridgeDeskExpiresAt = null
  }
  if (Object.keys(secretPatch).length > 0) {
    await patchSecrets(secretPatch)
  }

  await patchPublicSettings({
    conferenceId: result.conferenceId,
    conferenceName: result.conferenceName,
  })

  return {
    id: result.conferenceId,
    name: result.conferenceName,
    deskRole: result.deskRole ?? null,
    deskExpiresAt: result.deskExpiresAt ?? null,
  }
}

export interface LinkedJoinResult {
  success: boolean
  conferenceId: string | null
  conferenceName: string | null
  expiresAt: string | null
  message: string | null
}

/** Sprint 22.3/22.5 — redeem a Principal-issued Linked Desktop join code. */
export async function redeemLinkedDesktopJoin(input: {
  joinCode: string
  label?: string | null
}): Promise<LinkedJoinResult> {
  try {
    const code = canonicalizeJoinCode(input.joinCode)
    if (!code) {
      return {
        success: false,
        conferenceId: null,
        conferenceName: null,
        expiresAt: null,
        message: 'Enter the connection code from the Principal Desktop.',
      }
    }

    const installationId = readOrCreateInstallationIdSync()

    const result = await invokeDesktopFunction<{
      deskToken: string
      deskDeviceId: string
      conferenceId: string
      conferenceName: string | null
      regfoxEventId: string | null
      role?: string
      expiresAt: string
      rejoined?: boolean
    }>('desktop-redeem-join', {
      joinCode: code,
      label: input.label?.trim() || null,
      installationId,
    })

    if (!result.deskToken || !result.deskDeviceId || !result.conferenceId || !result.expiresAt) {
      return {
        success: false,
        conferenceId: null,
        conferenceName: null,
        expiresAt: null,
        message: 'Unable to connect with that code.',
      }
    }

    // Persist credential only after a successful Cloud redeem payload.
    await patchSecrets({
      foxbridgeDeskToken: result.deskToken,
      foxbridgeDeskDeviceId: result.deskDeviceId,
      foxbridgeDeskConferenceId: result.conferenceId,
      foxbridgeDeskRole: 'linked',
      foxbridgeDeskExpiresAt: result.expiresAt,
    })

    try {
      await patchPublicSettings({
        conferenceId: result.conferenceId,
        conferenceName: result.conferenceName,
        // Do not copy regfoxEventId from Cloud into local settings on Linked join.
        // Event identity from a join code must never satisfy Principal ownership proof.
      })
    } catch {
      // Desk credential is already stored; connection can still succeed.
    }

    return {
      success: true,
      conferenceId: result.conferenceId,
      conferenceName: result.conferenceName,
      expiresAt: result.expiresAt,
      message: null,
    }
  } catch (error) {
    return {
      success: false,
      conferenceId: null,
      conferenceName: null,
      expiresAt: null,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to join with that connection code.',
    }
  }
}

export interface IssuedJoinCode {
  joinCode: string
  joinCodeId: string
  conferenceId: string
  expiresAt: string
  ttlMinutes: number
}

export async function issueLinkedDesktopJoinCode(input?: {
  label?: string | null
  ttlMinutes?: number
}): Promise<IssuedJoinCode> {
  const desk = requireDeskCredential()
  return invokeDesktopFunction<IssuedJoinCode>(
    'desktop-issue-join-code',
    {
      label: input?.label?.trim() || null,
      ttlMinutes: input?.ttlMinutes ?? 15,
    },
    desk.deskToken,
  )
}

export interface ConnectedDeskRow {
  id: string
  label: string | null
  role: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
  isCurrent: boolean
}

export async function listConnectedDesks(): Promise<{
  conferenceId: string
  desks: ConnectedDeskRow[]
}> {
  const desk = requireDeskCredential()
  return invokeDesktopFunction(
    'desktop-list-desks',
    {},
    desk.deskToken,
  )
}

export async function revokeLinkedDesktop(deskDeviceId: string): Promise<{
  deskDeviceId: string
  revokedAt: string
}> {
  const desk = requireDeskCredential()
  return invokeDesktopFunction(
    'desktop-revoke-desk',
    { deskDeviceId },
    desk.deskToken,
  )
}

export async function publishAttendeesViaDesk(input: {
  conferenceId: string
  attendees: object[]
  mealEntitlements: object[]
  publishedAt: string
}): Promise<{ attendeeCount: number; publishedAt: string }> {
  const desk = requireDeskCredential()
  if (input.conferenceId !== desk.conferenceId) {
    throw new Error('Desk credential is not authorized for that FoxBridge Cloud event.')
  }

  const result = await invokeDesktopFunction<{
    attendeeCount: number
    publishedAt: string
  }>(
    'desktop-publish',
    {
      conferenceId: desk.conferenceId,
      attendees: input.attendees,
      mealEntitlements: input.mealEntitlements,
      publishedAt: input.publishedAt,
    },
    desk.deskToken,
  )

  return {
    attendeeCount: result.attendeeCount,
    publishedAt: result.publishedAt,
  }
}

export async function createPairingViaDesk(input: {
  tokenHash: string
  expiresAt: string
}): Promise<{ tokenId: string }> {
  const desk = requireDeskCredential()
  const result = await invokeDesktopFunction<{ tokenId: string }>(
    'desktop-create-pairing',
    {
      conferenceId: desk.conferenceId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    },
    desk.deskToken,
  )
  return { tokenId: result.tokenId }
}

export async function getPairingStatusViaDesk(tokenId: string): Promise<{
  used: boolean
  usedAt: string | null
}> {
  const desk = requireDeskCredential()
  return invokeDesktopFunction(
    'desktop-pairing-status',
    {
      conferenceId: desk.conferenceId,
      tokenId,
    },
    desk.deskToken,
  )
}

export async function ensureScannerSessionViaDesk(): Promise<{
  code: string
  label: string
}> {
  const desk = requireDeskCredential()
  return invokeDesktopFunction(
    'desktop-ensure-scanner-session',
    { conferenceId: desk.conferenceId },
    desk.deskToken,
  )
}

/** Anon client for Cloud reads that RLS already permits (e.g. meal validation pull). */
export function getSupabaseAnonClient(): SupabaseClient | null {
  const publicConfig = resolveFoxBridgeCloudPublicConfig()
  if (!publicConfig) {
    return null
  }

  return createClient(publicConfig.cloudUrl, publicConfig.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function hashPairingToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}
