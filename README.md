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

## Android-app

De Android-app (Capacitor, `android/`, plan in `docs/plan-capacitor.md`) laadt de webcode live van de site. Een gemergde PR staat dus meteen ook in de app; alleen wijzigingen in `android/` of `capacitor.config.ts` vragen een nieuwe installatie.

Eenmalig: [Android Studio](https://developer.android.com/studio) installeren en de wizard doorlopen (die installeert de Android SDK). Daarnaast Java 21: Gradle 8.14 draait niet op de Java 25 van Android Studio. `android/gradle/gradle-daemon-jvm.properties` laat Gradle zelf een Java 21 kiezen; zet er een neer met het archief van [Adoptium](https://adoptium.net) (Temurin 21), uitgepakt in `~/Library/Java/JavaVirtualMachines/`. Homebrew bouwt Java op een Intel-Mac met de nieuwste macOS uit de broncode, en dat duurt uren. Op de telefoon de ontwikkelaarsopties aanzetten (Instellingen → Over de telefoon → zeven keer op het buildnummer tikken) en daarin USB-foutopsporing. Telefoon met USB aansluiten en de vraag op de telefoon toestaan.

```bash
npx cap sync android   # config en plugins naar android/ kopiëren
npx cap run android    # bouwen en installeren op de aangesloten telefoon
npx cap open android   # of: openen in Android Studio (daar op Run ▶)
```

Een branch testen vóór het mergen: `CAP_SERVER_URL=<preview-adres van Cloudflare> npx cap sync android` en daarna `npx cap run android`. Daarna weer zonder `CAP_SERVER_URL` syncen.

Native code staat in `android/app/src/main/java/nl/hegmus/fluistervink/` (Java, zoals de `MainActivity` die Capacitor aanmaakt). De webcode praat er alleen mee via `src/lib/native.ts`.

## Stack

- [Vite](https://vite.dev) als build tool en dev server
- [Svelte 5](https://svelte.dev) met TypeScript
- [Dexie](https://dexie.org) als wrapper om IndexedDB (`src/lib/db.ts`)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) voor manifest en service worker
- [Capacitor](https://capacitorjs.com) voor de Android-app (`android/`)
- Cloudflare Worker (`worker/index.ts`) als proxy naar OpenAI en Anthropic, met [@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/vite-plugin/) zodat hij in de dev server meedraait

## Deploy

Eén Cloudflare Worker serveert de app en de `/api`-routes. Workers Builds bouwt en deployt automatisch bij elke push naar GitHub. Er zijn twee omgevingen: de **beta** (branch `main`, workers.dev, voor testers) en de **stabiele** versie (branch `stable`, `fluistervink.nl`, bijwerken met `npm run release`). Hieronder de beta; de stabiele staat in `docs/omgevingen.md`.

Eenmalig instellen in het Cloudflare-dashboard:

1. Workers & Pages → Create → Import a repository → kies deze repo.
2. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.
3. Geheimen instellen (Settings → Variables and Secrets, type *Secret*): `ACCESS_CODE`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`. Of vanaf de terminal: `npx wrangler secret put ACCESS_CODE`. De productie-`ACCESS_CODE` lang en willekeurig kiezen en in de wachtwoordmanager bewaren: Cloudflare toont geheimen niet meer na opslaan. Kwijt? Gewoon een nieuwe instellen en opnieuw invullen in de app.

Handmatig deployen kan ook: `npm run deploy`.

## Testers uitnodigen

Elke tester krijgt een eigen toegangscode. Het makkelijkst vanuit de app: scherm **Developer** (menu, alleen voor de eigenaar) → naam en e-mailadres invullen → **Uitnodigen en mailen**. De proxy maakt een code (bewaard in KV, binding `TESTERS`) en je mail-app opent met een kant-en-klaar bericht met de link; je verstuurt het zelf, vanaf je eigen adres. Het e-mailadres wordt nergens bewaard. Op hetzelfde scherm staan alle testers, met de link opnieuw te kopiëren en een knop om iemand af te sluiten. Een nieuwe of afgesloten code werkt binnen een minuut overal (KV wordt even gecachet).

Of met één commando vanaf de computer:

```bash
npm run tester -- add anna                # code maken, naar Cloudflare, link tonen
npm run tester -- list                    # alle testers met hun uitnodigingslink
npm run tester -- remove anna             # tester afsluiten
npm run tester -- url https://…           # ander adres in de links (standaard productie)
```

Het script houdt de codes bij in `.testers.json` (niet in git) en zet ze als geheim `ACCESS_CODES` in Cloudflare, via `wrangler` (eenmalig `npx wrangler login`): in productie (beta), in de stabiele versie én in de Previews Base, want previews erven geen geheimen van productie. Een bestaande preview krijgt de nieuwe lijst pas bij zijn volgende deploy. Werk je op een andere computer, kopieer `.testers.json` dan mee (of bewaar hem in de wachtwoordmanager); anders begint de lijst daar leeg en overschrijft `add` de testers die er al waren.

Stuur de tester de link. Op Android: de link in Chrome openen (de app bewaart de code en heet de tester welkom op het hoofdscherm), daarna pas "Toevoegen aan startscherm". Jouw eigen `ACCESS_CODE` blijft gewoon werken, als tester "eigenaar". In Workers Logs staat bij elk verzoek welke tester het deed.

Testers uit het script staan ook in de lijst in de app, maar zijn daar niet af te sluiten; testers uit de app staan niet in `.testers.json`. Gebruik niet dezelfde naam in beide.

Met de hand kan ook: `ACCESS_CODES` is JSON, `{"anna": "code", "piet": "code"}`, in te stellen in het dashboard onder Variables and Secrets.

### Wat testers delen ophalen

De app deelt gestopte wandelingen (met feedback, correcties en het log) automatisch met de proxy; opnames alleen als de tester dat aanzet op het Feedback-scherm.

```bash
npm run feedback -- pull    # nieuwe en gewijzigde wandelingen ophalen → testset/feedback/
npm run feedback -- notes   # alle feedback van testers als Markdown
npm run feedback -- wipe anna   # alles van één tester wissen (online en lokaal), op verzoek
npm run testset -- testset/feedback/anna.json
```

`pull` vraagt één keer om jouw productie-`ACCESS_CODE` en bewaart die in `.testers.json`. Andere server: `FLUISTERVINK_URL=http://localhost:5173 npm run feedback -- pull`.
