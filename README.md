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

Elke tester krijgt een eigen toegangscode. Dat gaat met één commando:

```bash
npm run tester -- add anna                # code maken, naar Cloudflare, link tonen
npm run tester -- list                    # alle testers met hun uitnodigingslink
npm run tester -- remove anna             # tester afsluiten
npm run tester -- url https://…           # ander adres in de links (standaard productie)
```

Het script houdt de codes bij in `.testers.json` (niet in git) en zet ze als geheim `ACCESS_CODES` in Cloudflare, via `wrangler` (eenmalig `npx wrangler login`): in productie én in de Previews Base, want previews erven geen geheimen van productie. Een bestaande preview krijgt de nieuwe lijst pas bij zijn volgende deploy. Werk je op een andere computer, kopieer `.testers.json` dan mee (of bewaar hem in de wachtwoordmanager); anders begint de lijst daar leeg en overschrijft `add` de testers die er al waren.

Stuur de tester de link. Op Android: de link in Chrome openen (de app bewaart de code en heet de tester welkom op het hoofdscherm), daarna pas "Toevoegen aan startscherm". Jouw eigen `ACCESS_CODE` blijft gewoon werken, als tester "eigenaar". In Workers Logs staat bij elk verzoek welke tester het deed.

Met de hand kan ook: `ACCESS_CODES` is JSON, `{"anna": "code", "piet": "code"}`, in te stellen in het dashboard onder Variables and Secrets.
