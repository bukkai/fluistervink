# Plan: de app gebruiken zonder toegangscode

Voorstel van 28 okt 2026, dezelfde dag goedgekeurd met deze keuzes: de eigenaar betaalt voorlopig alles; plafond en daglimiet stelt hij in bij de consoles van OpenAI en Anthropic (fase 1 en de daglimiet per installatie vervallen dus; de snelheidslimiet per installatie blijft); ook de PWA zonder code; openbaar in Play pas na genoeg testen. Fase 2 tot 4 gebouwd in één PR. Volgt op het besluit van 13 okt in `NOTES.md` (roadmap naar v1.0): v1.0 voorlopig voor een besloten kring met toegangscodes; openbaar pas als duidelijk is wie de API-kosten betaalt en hoe misbruik wordt afgevangen. Dit plan werkt dat tweede deel uit.

## Doel

Iemand installeert de app en kan meteen wandelen: geen e-mailadres, geen wachtwoord, geen code. Tegelijk blijft het tegoed bij OpenAI en Anthropic beschermd.

Uitzondering: tijdens de interne en gesloten test van Google Play voegt de eigenaar testers toe op e-mailadres. Dat eist Google, niet de app.

## Waarom er nu een code is

De proxy (`/api/transcribe`, `/api/messages`) staat open op internet. De code (`authorize` in `worker/index.ts`) zorgt dat alleen bekenden het tegoed gebruiken, dat je één tester kunt afsluiten, en dat gebruik, kosten en feedback per tester te zien zijn. Een code die in de app zelf zit, beschermt niets: wie de app uit elkaar haalt, vindt hem.

Wat er al is en blijft:

- **Vooraf betaald tegoed met auto-reload uit**, bij beide aanbieders. Dat is de harde grens: meer dan het tegoed kan het nooit kosten.
- **Snelheidslimiet** per tester (`AI_LIMIT`, 60 verzoeken per minuut, de eigenaar uitgezonderd).
- **Verbruik per dag, tester, omgeving, wandeling en model** in D1 (`worker/usage.ts`), omgerekend naar dollars met `src/lib/costs.ts`.

## Wat niet verandert

- De eigenaarscode (`ACCESS_CODE`) blijft, voor Developer, kosten, feedback ophalen en de testset.
- Testercodes kunnen blijven, bijvoorbeeld voor een hogere limiet of een naam bij de feedback. Ze zijn alleen niet meer nodig om de app te gebruiken.
- De webcode blijft platformonafhankelijk; native functies alleen via `src/lib/native.ts`.

## De aanpak in het kort

1. **Totaalplafond:** de proxy weigert verzoeken als het verbruik van deze maand boven een bedrag uitkomt. Een verzekering die ook nu al nuttig is.
2. **Anonieme installaties:** bij de eerste keer openen meldt de app zich onzichtbaar aan en krijgt een token. Elke installatie heeft een eigen daglimiet en kan los afgesloten worden.
3. **Echtheid bewijzen:** zodat niemand met een script duizenden installaties aanmaakt. In de Android-app met de Play Integrity API van Google, in de browser met Cloudflare Turnstile (een onzichtbare controle, geen puzzel).
4. **De code uit de app halen:** welkom zonder code, feedback met een optionele naam, `#uitleg` en `#privacy` bijwerken.

## Fasen

Elke fase is één à twee PR's. Fase 1 staat los van de rest en kan meteen.

### Fase 1: totaalplafond in de proxy

- Nieuwe var `MONTHLY_BUDGET_USD` in `wrangler.jsonc` (per omgeving, of één bedrag voor beide samen; zie open punten).
- Vóór elk verzoek aan OpenAI of Anthropic telt de proxy het verbruik van deze maand op uit D1 en rekent het om met de prijstabel. Om niet bij elk verzoek de hele maand op te tellen: het totaal een minuut bewaren in het geheugen van de Worker. Een paar verzoeken over het plafond is geen probleem.
- Boven het plafond: `503` met een duidelijke tekst ("De app heeft zijn maandbudget bereikt"). De uitspraak blijft in de wachtrij staan, zoals bij geen bereik. De eigenaar valt erbuiten.
- Bij 80% en bij 100% een regel in Workers Logs; op Developer bij de kaart Kosten een balk "budget deze maand".
- Tests in `worker/index.test.ts`: onder het plafond door, erboven geweigerd, eigenaar altijd door.

### Fase 2: anonieme installaties

- De app maakt bij de eerste keer openen een installatie-ID (`crypto.randomUUID()`) en vraagt de proxy om een token: `POST /api/install`.
- Het token is ondertekend door de proxy (HMAC met een nieuw geheim), met daarin het installatie-ID en de datum. De proxy hoeft het dus niet bij elk verzoek op te zoeken. Alleen afgesloten installaties staan in KV (`TESTERS`).
- In het verbruik, de snelheidslimiet en de feedback neemt het installatie-ID de plaats van de testernaam in (bv. `installatie-3f9a…`). De D1-tabel hoeft niet te veranderen.
- **Daglimiet per installatie**, ruim genoeg dat een normale wandeling er nooit tegenaan loopt (bv. 300 uitspraken per dag). Daarboven een nette melding.
- In deze fase vraagt `/api/install` nog een testercode, zodat er nog niets openstaat. Zo kan alles eerst met de huidige testers draaien.
- Developer: lijst van installaties met gebruik en een knop afsluiten, naast de testers.

### Fase 3: echtheid bewijzen

- **Android-app: Play Integrity API.** De app vraagt bij Google een verklaring dat hij echt uit Play komt en niet aangepast is, en stuurt die mee met `/api/install`. De proxy laat de verklaring controleren door Google (`decodeIntegrityToken`, met een serviceaccount als geheim). Native code, dus een nieuwe app-versie (tag `v0.*`). Werkt alleen voor installaties uit Play, niet voor een debug-APK; die blijft een testercode gebruiken.
- **Browser (PWA): Cloudflare Turnstile**, onzichtbaar. Een nieuwe externe bron: `challenges.cloudflare.com` moet erbij in `public/_headers`, en `#privacy` moet het noemen.
- Daarna kan `/api/install` zonder code.

### Fase 4: de code uit de app

- Welkom op het hoofdscherm zonder code: app openen en wandelen. De vraag om gegevens te delen blijft.
- Instellingen: de code wordt een optioneel veld ("Heb je een testercode?"), plus een optionele naam voor bij de feedback.
- `#uitleg` en `#privacy` bijwerken: installatie-ID, Play Integrity (Google) en Turnstile (Cloudflare).
- `CLAUDE.md` bijwerken (Toegang).
- Kwaliteitsronde (`docs/kwaliteitsronde.md`): gegevens gaan een nieuwe kant op, en er komt een nieuwe groep gebruikers.

## Open punten voor de eigenaar

1. **Wie betaalt bij veel gebruikers?** Stand 11 okt: ruwweg een tiende cent per uitspraak bij Anthropic, plus de spraakherkenning bij OpenAI; de echte bedragen per wandeling staan op Developer. Met een plafond weet je het maximum, maar bij veel gebruikers zitten ze aan het eind van de maand stil. Mogelijkheden: gratis met een vaste limiet, een vrijwillige bijdrage, of later betalen in de app. Hoeft niet vóór fase 1 tot 3 besloten te zijn.
2. **Hoogte van het plafond en de daglimiet.** Eén plafond voor beta en stabiel samen is het eenvoudigst, want het tegoed is ook gedeeld.
3. **Alleen de Android-app zonder code, of ook de PWA?** Alleen de app scheelt Turnstile en een nieuwe externe bron; de PWA houdt dan de code. Nadeel: iPhone-gebruikers (Safari) hebben dan nog wel een code nodig.
4. **Openbaar in Play.** Met een persoonlijk ontwikkelaarsaccount eist Google eerst een gesloten test met minstens 12 testers gedurende 14 dagen. Dat is een aparte stap, los van dit plan.

## Voorstel

Fase 1 nu, als losse PR: het is een kleine wijziging in de proxy en een goedkope verzekering, ook zolang de codes blijven. Fase 2 tot 4 pas als besloten is om (een deel van) de app openbaar te maken.

## Instellen (eigenaar, eenmalig)

Zonder deze instellingen staat aanmelden zonder code uit: wie een code heeft, merkt niets; wie geen code heeft, ziet op het hoofdscherm dat aanmelden niet lukt. Elk geheim voor beide omgevingen zetten (`--env stable` voor de stabiele).

1. **Token-geheim:** een lange willekeurige tekst, bv. `openssl rand -base64 32`, met `npx wrangler secret put INSTALL_SECRET`. Verander je hem later, dan melden alle installaties zich vanzelf opnieuw aan.
2. **Turnstile** (Cloudflare-dashboard → Turnstile → Add widget): hostnamen `fluistervink.stephanmullernl.workers.dev` en `fluistervink.nl`, modus *Managed* (meestal onzichtbaar, alleen bij twijfel een vinkje). De site key in `wrangler.jsonc` bij `TURNSTILE_SITE_KEY` (beide omgevingen), de secret key met `npx wrangler secret put TURNSTILE_SECRET`.
3. **Play Integrity** (alleen de Android-app; zonder valt die terug op Turnstile):
   - Play Console → Test en release → App-integriteit → Play Integrity API: een Google Cloud-project koppelen (of laten aanmaken).
   - In dat Cloud-project: de Play Integrity API aanzetten; onder IAM → Serviceaccounts een serviceaccount maken en daarvan een JSON-sleutel downloaden.
   - `npx wrangler secret put PLAY_SERVICE_ACCOUNT < sleutel.json`, daarna het bestand weggooien.
   - Het projectnummer (12 cijfers, Cloud-dashboard, "Project number"; niet de "Unieke ID" van 21 cijfers van het serviceaccount) mag in `wrangler.jsonc` bij `PLAY_PROJECT_NUMBER`, maar is niet nodig: voor een app uit Play gebruikt Google het gekoppelde project. Een verkeerd nummer laat Play Integrity mislukken (dan valt de app terug op Turnstile).
   - Een nieuwe app-versie (tag `v0.*`): de plugin zit in de native code. Een debug-APK krijgt van Google geen goedkeuring en gebruikt Turnstile.
   - Play Console → App-inhoud → Gegevensveiligheid nalopen (installatie-id naar Google voor de controle).
4. **Lokaal** (`.dev.vars`): de testsleutels van Turnstile die altijd slagen, site key `1x00000000000000000000AA` en secret `1x0000000000000000000000000000000AA`, plus een willekeurig `INSTALL_SECRET`.
