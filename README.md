# Fluistervink

Spraakgestuurde vogelwaarnemingen. Tijdens het vogelen druk je op een knop en spreek je in wat je ziet of hoort ("zes overvliegende houtduiven", "roepje vink"). De app legt tijd en plek vast, maakt er een waarneming van en bevestigt met een tril, zodat je niet naar het scherm hoeft te kijken. Thuis loop je de waarnemingen na en exporteer je ze naar [waarneming.nl](https://waarneming.nl).

Fluistervink is een Android-app (in test in Google Play) en werkt ook in de browser op [fluistervink.nl](https://fluistervink.nl). Hoe het werkt en wat er met je gegevens gebeurt, staat in de app onder "Hoe werkt het?" en "Privacy".

## Waar staat wat

- `CLAUDE.md`: het ontwerp, de vastgelegde keuzes en de werkafspraken.
- `NOTES.md`: de stand van vandaag en wat nog moet.
- `docs/`: roadmap, plannen en naslag; `docs/README.md` geeft een overzicht.

## Ontwikkelen

Vereist Node 22 (zie `.node-version`). Kopieer eerst `.dev.vars.example` naar `.dev.vars` en vul in:

- `ACCESS_CODE`: alleen voor de lokale Worker; kies iets simpels, mag per computer verschillen.
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

## Testers

Er zijn geen testercodes meer: iedereen installeert de app (Android uit Google Play, zie `docs/google-play.md`; anders de site in Chrome of Safari) en de app meldt zich vanzelf aan als installatie ("app-3f9a2b1c"). Op het scherm **Developer** (menu, alleen voor de eigenaar) staan alle installaties, met de naam die iemand bij Instellingen opgaf, en een knop om er een af te sluiten.

Alleen jij hebt een code, `ACCESS_CODE`: vul hem in bij **Instellingen → Code van de ontwikkelaar**, dan ben je "eigenaar" (Developer, Statistieken, kosten, geen snelheidslimiet). In Workers Logs staat bij elk verzoek welke installatie het deed.

### Wat testers delen ophalen

De app deelt gestopte sessies (met feedback, correcties en het log) automatisch met de proxy; opnames alleen als de tester dat aanzet op het Feedback-scherm.

```bash
npm run feedback -- pull    # nieuwe en gewijzigde sessies ophalen → testset/feedback/
npm run feedback -- notes   # alle feedback van testers als Markdown
npm run feedback -- wipe anna   # alles van één tester wissen (online en lokaal), op verzoek
npm run testset -- testset/feedback/anna.json
```

`pull` vraagt één keer om jouw productie-`ACCESS_CODE` en bewaart die in `.testers.json`. Andere server: `FLUISTERVINK_URL=http://localhost:5173 npm run feedback -- pull`.

## Licentie

Copyright © 2026 Stephan Muller.

Fluistervink is vrije software onder de [GNU Affero General Public License, versie 3](LICENSE) (alleen versie 3, `AGPL-3.0-only`). Je mag de code gebruiken, aanpassen en verspreiden, ook als dienst op een server, zolang je je eigen versie onder dezelfde licentie openbaar maakt, inclusief de broncode van wat op de server draait.

Versies tot en met commit `8dbc86f` (11 november 2026) zijn gepubliceerd onder de MIT-licentie en blijven daaronder beschikbaar.

Bijdragen: zie [CONTRIBUTING.md](CONTRIBUTING.md).
