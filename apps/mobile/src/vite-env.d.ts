/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_MOBILE_ACCESS_CODE?: string
  readonly VITE_MOBILE_BUILD_ID?: string
  readonly VITE_VERCEL_GIT_COMMIT_SHA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export {}
