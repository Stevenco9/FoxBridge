import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    return null
  }

  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null
}

export function getSupabaseClient(): SupabaseClient | null {
  const env = getSupabaseEnv()
  if (!env) {
    return null
  }

  if (!client) {
    client = createClient(env.url, env.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  return client
}

export async function checkSupabaseConnection(): Promise<boolean> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return false
  }

  try {
    const { error } = await supabase.from('conferences').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}
