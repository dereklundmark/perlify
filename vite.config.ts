import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Served from a GitHub Pages project subpath (https://<user>.github.io/perlify/),
// so every absolute path needs that prefix — see index.html's %BASE_URL% uses too.
const BASE = '/perlify/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Perlify',
        short_name: 'Perlify',
        description: 'Turn a photo into a bead pattern sized to your own pegboard.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f1ea',
        theme_color: '#c2542f',
        icons: [
          { src: `${BASE}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${BASE}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${BASE}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Everything the app needs is bundled/self-hosted (fonts, icons, JS/CSS)
      // and there are no network requests to cache at runtime — precaching
      // the build output is what makes "works in airplane mode" true.
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
      },
    }),
  ],
})
