# Fluistervink

Spraakgestuurde vogelwaarnemingen. Zie `CLAUDE.md` voor het ontwerp en `NOTES.md` voor de stand van zaken.

## Ontwikkelen

Vereist Node 22 (zie `.node-version`). Kopieer eerst `.dev.vars.example` naar `.dev.vars` en vul in:

- `ACCESS_CODE`: alleen voor de lokale Worker; kies iets simpels, mag per computer verschillen.
- `ACCESS_CODES` (optioneel): codes voor testers, zie "Testers uitnodigen".
- `OPENAI_API_KEY` en `ANTHROPIC_API_KEY`: maak per computer een nieuwe sleutel aan (ze worden maar één keer getoond), zodat je ze los kunt intrekken.

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
3. Geheimen instellen (Settings → Variables and Secrets, type *Secret*): `ACCESS_CODE`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. Of vanaf de terminal: `npx wrangler secret put ACCESS_CODE`. De productie-`ACCESS_CODE` lang en willekeurig kiezen en in de wachtwoordmanager bewaren: Cloudflare toont geheimen niet meer na opslaan. Kwijt? Gewoon een nieuwe instellen en opnieuw invullen in de app.

Handmatig deployen kan ook: `npm run deploy`.

## Testers uitnodigen

Elke tester krijgt een eigen code in het geheim `ACCESS_CODES`, als JSON:

```json
{"anna": "lange-willekeurige-code", "piet": "nog-een-andere-code"}
```

Instellen in het dashboard (Variables and Secrets) of met `npx wrangler secret put ACCESS_CODES` (plak de hele JSON). Een willekeurige code maken: `openssl rand -base64 18 | tr '+/' '-_'`. Toevoegen of afsluiten = de hele JSON opnieuw instellen; Cloudflare toont hem niet terug, dus bewaar hem in de wachtwoordmanager.

Stuur de tester dan de uitnodigingslink `https://<app-url>/#code=<code>`. Op Android: de link in Chrome openen (de app bewaart de code en laat "Verbonden als anna" zien), daarna pas "Toevoegen aan startscherm". Jouw eigen `ACCESS_CODE` blijft gewoon werken, als tester "eigenaar". In Workers Logs staat bij elk verzoek welke tester het deed.
