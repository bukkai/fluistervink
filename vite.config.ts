import { execSync } from 'node:child_process';
import { cloudflare } from '@cloudflare/vite-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Welke code draait er? Bij elke uitspraak bewaard, zodat fouten later bij
// een versie te zoeken zijn. Workers Builds geeft de commit mee; lokaal
// vragen we het git zelf.
function appVersion(): string {
  const sha = process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7);
  if (sha) return sha;
  try {
    const local = execSync('git rev-parse --short HEAD').toString().trim();
    const dirty = execSync('git status --porcelain').toString().trim() ? '+' : '';
    return `${local}${dirty}`;
  } catch {
    return 'onbekend';
  }
}

// Stabiel (npm run build:stable, op fluistervink.nl) heet gewoon Fluistervink,
// de rest is beta. Zie docs/omgevingen.md.
const appName = process.env.CLOUDFLARE_ENV === 'stable' ? 'Fluistervink' : 'Fluistervink Beta';

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [
    svelte(),
    // Draait de Worker (worker/index.ts) mee in de dev server, zodat
    // `npm run dev` zowel de app als /api lokaal serveert.
    cloudflare(),
    // Maakt het manifest en een service worker (Workbox) die de app-bestanden
    // cachet, zodat de app installeerbaar is en ook zonder netwerk opent.
    VitePWA({
      // Niet vanzelf herladen bij een nieuwe versie: src/lib/update.ts wacht
      // tot er geen wandeling loopt
      registerType: 'prompt',
      workbox: {
        // API-verzoeken nooit via de cache of de index.html-fallback laten lopen
        navigateFallbackDenylist: [/^\/api\//],
        // Ook afbeeldingen (de meeuwen van de zeemeeuw-grap), zodat ze offline werken
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
      includeAssets: ['icon.svg', 'logo.svg', 'apple-touch-icon.png'],
      manifest: {
        name: appName,
        short_name: appName,
        description: 'Spraakgestuurde vogelwaarnemingen',
        lang: 'nl',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f1ed',
        theme_color: '#6f7587',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // Oog en snavel staan binnen de veilige zone, dus rond afsnijden mag
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
