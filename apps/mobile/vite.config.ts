import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const mobileRoot = path.dirname(fileURLToPath(import.meta.url))
const buildId = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || String(Date.now())

export default defineConfig({
  define: {
    'import.meta.env.VITE_MOBILE_BUILD_ID': JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      '@foxbridge/shared-meals': path.resolve(mobileRoot, '../../src/shared/meals'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'FoxBridge Mobile',
        short_name: 'FoxBridge',
        description: 'Meal validation scanner for conference volunteers',
        theme_color: '#111827',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
      },
    }),
  ],
  server: {
    port: 5174,
    host: '0.0.0.0',
  },
})
