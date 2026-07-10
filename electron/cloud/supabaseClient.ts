import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadSupabaseConnectionConfig, type SupabaseConnectionConfig } from './supabaseConfig'

let serviceClient: SupabaseClient | null = null
let activeConfig: SupabaseConnectionConfig | null = null

export function getSupabaseServiceClient(): SupabaseClient | null {
  const config = loadSupabaseConnectionConfig()
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

export function resetSupabaseServiceClient(): void {
  serviceClient = null
  activeConfig = null
}
