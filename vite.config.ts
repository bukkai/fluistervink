import { cloudflare } from '@cloudflare/vite-plugin'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    // Draait de Worker (worker/index.ts) mee in de dev server, zodat
    // `npm run dev` zowel de app als /api lokaal serveert.
    cloudflare(),
    // Maakt het manifest en een service worker (Workbox) die de app-bestanden
    // cachet, zodat de app installeerbaar is en ook zonder netwerk opent.
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // API-verzoeken nooit via de cache of de index.html-fallback laten lopen
        navigateFallbackDenylist: [/^\/api\//],
      },
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Thijsse',
        short_name: 'Thijsse',
        description: 'Spraakgestuurde vogelwaarnemingen',
        lang: 'nl',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f5ef',
        theme_color: '#2f6b3a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
