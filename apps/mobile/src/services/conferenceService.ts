import { getSupabaseClient } from '../lib/supabaseClient'
import type { ConferenceSummary, ScannerCodeValidation } from '../models/session'

export async function listConferences(): Promise<ConferenceSummary[]> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('conferences')
    .select('id, name, slug')
    .order('name')

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }))
}

export async function getConferenceBySlug(slug: string): Promise<ConferenceSummary | null> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const normalized = slug.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const { data, error } = await supabase
    .from('conferences')
    .select('id, name, slug')
    .eq('slug', normalized)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
  }
}

export async function validateScannerCode(code: string): Promise<ScannerCodeValidation | null> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const normalized = code.trim()
  if (!normalized) {
    return null
  }

  const { data, error } = await supabase.rpc('validate_scanner_code', {
    scanner_code: normalized,
  })

  if (error) {
    throw new Error(error.message)
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return null
  }

  return {
    sessionId: row.session_id,
    conferenceId: row.conference_id,
    conferenceName: row.conference_name,
    label: row.label,
  }
}
