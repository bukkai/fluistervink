# Thijsse

Spraakgestuurde vogelwaarnemingen. Zie `CLAUDE.md` voor het ontwerp en `NOTES.md` voor de stand van zaken.

## Ontwikkelen

Vereist Node 22 (zie `.node-version`).

```bash
npm install
npm run dev      # dev server op http://localhost:5173
npm run check    # typecheck (TypeScript + Svelte)
npm run build    # productiebuild in dist/
npm run preview  # de build lokaal serveren, inclusief service worker
```

Op een telefoon testen: `npm run dev -- --host` en open het adres op hetzelfde wifi-netwerk. Microfoon en GPS werken alleen via HTTPS of localhost, dus voor echte veldtests de Cloudflare-deploy gebruiken.

## Stack

- [Vite](https://vite.dev) als build tool en dev server
- [Svelte 5](https://svelte.dev) met TypeScript
- [Dexie](https://dexie.org) als wrapper om IndexedDB (`src/lib/db.ts`)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) voor manifest en service worker

## Deploy

Cloudflare Pages bouwt automatisch bij elke push naar GitHub: `main` gaat naar productie, andere branches krijgen een preview-URL.

- Build command: `npm run build`
- Build output directory: `dist`
