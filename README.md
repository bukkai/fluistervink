# Thijsse

Spraakgestuurde vogelwaarnemingen. Zie `CLAUDE.md` voor het ontwerp en `NOTES.md` voor de stand van zaken.

## Ontwikkelen

Vereist Node 22 (zie `.node-version`). Kopieer eerst `.dev.vars.example` naar `.dev.vars` en vul de toegangscode en API-sleutels in.

```bash
npm install
npm run dev      # app + proxy (/api) op http://localhost:5173
npm run check    # typecheck (TypeScript + Svelte)
npm run build    # productiebuild in dist/
npm run preview  # de build lokaal serveren, inclusief service worker
npm run types    # Worker-types opnieuw genereren na wijzigen van wrangler.jsonc
```

Op een telefoon testen: `npm run dev -- --host` en open het adres op hetzelfde wifi-netwerk. Microfoon en GPS werken alleen via HTTPS of localhost, dus voor echte veldtests de Cloudflare-deploy gebruiken.

## Stack

- [Vite](https://vite.dev) als build tool en dev server
- [Svelte 5](https://svelte.dev) met TypeScript
- [Dexie](https://dexie.org) als wrapper om IndexedDB (`src/lib/db.ts`)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) voor manifest en service worker
- Cloudflare Worker (`worker/index.ts`) als proxy naar OpenAI en Anthropic, met [@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/vite-plugin/) zodat hij in de dev server meedraait

## Deploy

Eén Cloudflare Worker serveert de app en de `/api`-routes. Workers Builds bouwt en deployt automatisch bij elke push naar GitHub.

Eenmalig instellen in het Cloudflare-dashboard:

1. Workers & Pages → Create → Import a repository → kies deze repo.
2. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.
3. Geheimen instellen (Settings → Variables and Secrets, type *Secret*): `ACCESS_CODE`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. Of vanaf de terminal: `npx wrangler secret put ACCESS_CODE`.

Handmatig deployen kan ook: `npm run deploy`.
