import { getSupabaseServiceClient } from './supabaseClient'
import { patchPublicSettings, readPublicSettings } from '../settings/settingsStore'

function slugFromEventId(eventId: string): string {
  const slug = eventId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

  return slug || 'conference'
}

export async function resolveConferenceId(
  createIfMissing: boolean,
): Promise<{ id: string; name: string } | null> {
  const settings = await readPublicSettings()
  const eventId = settings.regfoxEventId?.trim()
  const client = getSupabaseServiceClient()

  if (!client || !eventId) {
    return null
  }

  const { data: byEvent, error: byEventError } = await client
    .from('conferences')
    .select('id, name')
    .eq('regfox_event_id', eventId)
    .maybeSingle()

  if (byEventError) {
    throw new Error(byEventError.message)
  }

  if (byEvent) {
    if (settings.conferenceId !== byEvent.id || settings.conferenceName !== byEvent.name) {
      await patchPublicSettings({
        conferenceId: byEvent.id,
        conferenceName: byEvent.name,
      })
    }
    return { id: byEvent.id, name: byEvent.name }
  }

  if (settings.conferenceId) {
    const { data: byId, error: byIdError } = await client
      .from('conferences')
      .select('id, name')
      .eq('id', settings.conferenceId)
      .maybeSingle()

    if (byIdError) {
      throw new Error(byIdError.message)
    }

    if (byId) {
      await client
        .from('conferences')
        .update({
          regfox_event_id: eventId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', byId.id)

      await patchPublicSettings({ conferenceName: byId.name })
      return { id: byId.id, name: byId.name }
    }
  }

  if (!createIfMissing) {
    return null
  }

  const conferenceName = settings.conferenceName?.trim() || `Conference ${eventId}`
  const { data: created, error: createError } = await client
    .from('conferences')
    .insert({
      slug: slugFromEventId(eventId),
      name: conferenceName,
      regfox_event_id: eventId,
    })
    .select('id, name')
    .single()

  if (createError || !created) {
    throw new Error(createError?.message ?? 'Unable to create conference record.')
  }

  await patchPublicSettings({
    conferenceId: created.id,
    conferenceName: created.name,
  })

  return { id: created.id, name: created.name }
}

export async function ensureConferenceId(): Promise<string> {
  const conference = await resolveConferenceId(true)
  if (!conference) {
    throw new Error('RegFox is not configured. Connect registration before publishing.')
  }

  return conference.id
}
