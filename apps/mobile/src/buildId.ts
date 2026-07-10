/** Set at build time via Vite define / env for PWA cache verification. */
export const MOBILE_BUILD_ID =
  import.meta.env.VITE_MOBILE_BUILD_ID ||
  import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ||
  'dev'
