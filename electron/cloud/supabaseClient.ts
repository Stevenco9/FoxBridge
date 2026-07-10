import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadSupabaseConfig, type SupabaseConfig } from './supabaseConfig'

let serviceClient: SupabaseClient | null = null
let activeConfig: SupabaseConfig | null = null

export function getSupabaseServiceClient(): SupabaseClient | null {
  const config = loadSupabaseConfig()
  if (!config) {
    serviceClient = null
    activeConfig = null
    return null
  }

  if (
    serviceClient &&
    activeConfig &&
    activeConfig.url === config.url &&
    activeConfig.serviceRoleKey === config.serviceRoleKey
  ) {
    return serviceClient
  }

  serviceClient = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  activeConfig = config

  return serviceClient
}
