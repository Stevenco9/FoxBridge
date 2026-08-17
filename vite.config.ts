import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const foxbridgeCloudDefines = {
    'process.env.FOXBRIDGE_CLOUD_URL': JSON.stringify(
      env.FOXBRIDGE_CLOUD_URL ?? process.env.FOXBRIDGE_CLOUD_URL ?? '',
    ),
    'process.env.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY': JSON.stringify(
      env.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY ??
        process.env.FOXBRIDGE_CLOUD_PUBLISHABLE_KEY ??
        '',
    ),
    'process.env.FOXBRIDGE_CLOUD_ANON_KEY': JSON.stringify(
      env.FOXBRIDGE_CLOUD_ANON_KEY ?? process.env.FOXBRIDGE_CLOUD_ANON_KEY ?? '',
    ),
    'process.env.FOXBRIDGE_SCANNER_URL': JSON.stringify(
      env.FOXBRIDGE_SCANNER_URL ?? process.env.FOXBRIDGE_SCANNER_URL ?? '',
    ),
    'process.env.MOBILE_APP_URL': JSON.stringify(
      env.MOBILE_APP_URL ?? process.env.MOBILE_APP_URL ?? '',
    ),
  }

  return {
    plugins: [
      react(),
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: {
            define: foxbridgeCloudDefines,
            build: {
              rollupOptions: {
                external: ['better-sqlite3', 'electron-updater'],
              },
            },
          },
        },
        preload: {
          input: 'electron/preload.ts',
        },
      }),
    ],
  }
})
