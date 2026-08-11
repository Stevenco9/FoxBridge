import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeEnrollmentCode } from '../../src/shared/cloud/deskCredentialPolicy'
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

export async function resolveConferenceViaDesk(input?: {
  regfoxEventId?: string | null
}): Promise<{ id: string; name: string }> {
  const desk = requireDeskCredential()
  const result = await invokeDesktopFunction<{
    conferenceId: string
    conferenceName: string
  }>(
    'desktop-resolve-conference',
    {
      conferenceId: desk.conferenceId,
      regfoxEventId: input?.regfoxEventId ?? null,
    },
    desk.deskToken,
  )

  await patchPublicSettings({
    conferenceId: result.conferenceId,
    conferenceName: result.conferenceName,
  })

  return { id: result.conferenceId, name: result.conferenceName }
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
