# Fluistervink — spraakgestuurde vogelwaarnemingen

Fluistervink is een app waarmee je tijdens het vogelen waarnemingen inspreekt ("Fluistervink, zes overvliegende houtduiven", "roepje vink"). De app legt tijd en locatie vast, zet de uitspraak om in een gestructureerde waarneming, en maakt export naar waarneming.nl mogelijk.

De naam is een woordgrap op "luistervink": je fluistert je waarnemingen in, en de vink is de vogel die je het vaakst inspreekt. "Fluistervink" is ook het (toekomstige) wake word. Tot oktober 2026 heette de app Thijsse (naar Jac. P. Thijsse).

## Werkwijze in het veld

1. App openen → sessie (= één wandeling) start. Een duidelijke knop "stop wandeling" beëindigt de sessie. Vergeten te stoppen: na een uur zonder uitspraken vraagt de app bij het openen of de wandeling nog loopt; na 8 uur stopt hij vanzelf, met de laatste uitspraak als eindtijd (`checkStaleSession` in `src/lib/sessions.ts`).
2. Iets gezien of gehoord → knop indrukken (MVP) of later het wake word "Fluistervink" zeggen, en de waarneming inspreken.
3. Elke uitspraak wordt verwerkt en verschijnt in het overzicht. Bevestiging via trillen, zodat de gebruiker niet naar het scherm hoeft te kijken.
4. Correcties kunnen in het veld met de stem: "nee, keep in plaats van vink", "nog drie erbij", "die laatste weg".
5. Thuis: review van soort, aantal, gedrag en locatie, nalopen van onzekere waarnemingen, audio terugluisteren. Snel nalopen: bovenaan de onzekere één voor één (Klopt, Weg, Aanpassen, Overslaan; `src/lib/UncertainReview.svelte`), daarna "Alles klopt" (`approveSession`): de rest geldt als nagelopen (na een bevestiging worden ook de onzekere zeker) en de wandeling staat klaar.
6. Een nagelopen wandeling zet je "klaar voor waarneming.nl". Wanneer het uitkomt, exporteer je alle klaarstaande wandelingen in één bestand (scherm Wandelingen; CSV in de browser, xlsx in de Android-app, omdat Android een .csv een type geeft dat het uploadveld van waarneming.nl uitgrijst; `src/lib/xlsx.ts`) en importeer je die bij waarneming.nl; ze zijn dan "geëxporteerd". Eén wandeling los exporteren kan ook. Later via de API (`/api/v1/observations/create/`, zie `NOTES.md`).

## Vastgelegde ontwerpkeuzes

- **Doelgroep:** persoonlijk gebruik, recreatief vogelen op wandelingen. Geen professionele inventarisatieprotocollen.
- **Front-end-stack:** Vite, Svelte 5 met TypeScript, Dexie (IndexedDB), vite-plugin-pwa. Gekozen omdat Svelte-runes en -templates dicht bij de Angular-ervaring van de eigenaar liggen, met weinig boilerplate.
- **Platform:** Android. Begonnen als PWA (Chrome op Android, werkt ook in Safari op een iPhone, zonder trillen); nu in Capacitor verpakt, in fasen (`docs/plan-capacitor.md`, goedgekeurd 13 okt). De app laadt de webcode live van de site (`server.url`), zodat een gemergde PR meteen ook in de app staat; alleen native wijzigingen vragen een nieuwe app-versie. App-ID `nl.hegmus.fluistervink`. Verspreiden via Google Play: een tag `v0.*` bouwt ondertekende AAB's (beta en stabiel, zie hieronder) in GitHub Actions (`.github/workflows/release.yml`, handleiding `docs/google-play.md`). Native functies alleen via `src/lib/native.ts`, met de web-API's als terugval: de PWA blijft werken, dus houd de webcode platformonafhankelijk.
- **Spraak naar tekst:** Whisper via de API van OpenAI (`gpt-4o-transcribe`, `gpt-4o-mini-transcribe` of `whisper-1`), met een soortenlijst in de prompt om herkenning van soortnamen te verbeteren. Gekozen op basis van de testset (12 okt): `gpt-4o-transcribe`.
- **Interpretatie:** een LLM (klein en snel model, bv. Claude Haiku) met tool use. Het model geeft acties terug, de app voert ze uit:
  - `add_observation`, `update_observation`, `delete_observation`, `undo`, `redo` (een undo terugdraaien)
  - Context per aanroep: de laatste waarnemingen van de huidige sessie, zodat verwijzingen als "die", "de vorige" en "nog drie" werken.
  - Soorten alleen via ID's uit een vaste soortenlijst (Nederlandse vogels, in de systeemprompt, met prompt caching). De app valideert elk soort-ID; het model kan geen soorten verzinnen.
  - Bij twijfel zet het model een `uncertain`-vlag in plaats van terug te vragen. Uitspraken zonder waarneming worden genegeerd.
- **Tijd en locatie:** vastleggen op het moment dat de opname start, inclusief GPS-nauwkeurigheid. Tijdens een wandeling blijft de GPS warm (`watchPosition`), zodat er bij een uitspraak direct een nauwkeurige positie is; is die ouder dan 15 s (bv. bij stilstaan), dan vraagt de app een verse meting. Lukt dat niet, dan de laatst bekende positie, hoe oud ook (lang stilstaan bij een hut of vogelscherm komt vaak voor); de meettijd blijft bewaard, zodat de leeftijd in de review zichtbaar is. Tussenliggende posities worden niet bewaard (geen GPS-track). De uitspraak wacht niet op de GPS: komt de positie later binnen, dan krijgen de waarnemingen hem alsnog.
- **Local-first:** elke uitspraak (audio, tijd, GPS) wordt eerst lokaal opgeslagen (IndexedDB) en daarna verwerkt, één voor één, op volgorde. Dit is in feite een wachtrij die normaal direct leeg is; echte offline-ondersteuning kan later met weinig moeite worden toegevoegd. De opname staat erin als bytes met het formaat (`StoredAudio` in `src/lib/db.ts`), niet als Blob: Safari kan een record met een Blob uit IndexedDB niet opnieuw wegschrijven. Faalt de database bij één uitspraak, dan gaat de wachtrij door met de volgende.
- **Vormgeving:** eenvoudig en rustig (inspiratie: vogelchecklist.nl). Kleuren van de mannetjesvink: blauwgrijs van de kop als hoofdkleur, roze-oranje van de borst als accent (opnemen, stoppen, verwijderen), lichte buik als achtergrond, witte kaarten. Zeldzaamheid met de kleuren van waarneming.nl, plus een vorm per niveau (rondje, vierkantje, ruitje, sterretje). Kleuren en gedeelde bouwstenen (`.card`, `.btn`, `.link`, invoervelden) staan in `src/app.css`. Geen webfont (offline).
- **Feedback:** trilpatronen. Eén korte tril = opgeslagen; twee = niet begrepen; een afwijkend patroon = opgeslagen maar onzeker.
- **API-sleutels:** nooit in de client. Een kleine proxy (`worker/index.ts`) praat met de STT- en LLM-API's: `/api/transcribe` (OpenAI) en `/api/messages` (Anthropic, doorgeefluik met een lijst toegestane modellen; alleen de velden, eigen tools en soorten inhoud die de app gebruikt, hooguit 256 kB, zodat een toegangscode geen vrije toegang tot het tegoed is). De app stelt prompt en tools zelf samen.
- **Beveiliging in de app:** een JSON-import kan van een tester komen en wordt gecontroleerd op typen (`checkImport` in `src/lib/export.ts`). Gebruik geen `innerHTML` met gegevens uit de database zonder escapen; liever DOM-elementen. `public/_headers` zet een Content-Security-Policy (alleen scripts en stijlen van de eigen site, kaarttegels van OpenStreetMap); een nieuwe externe bron moet daar ook bij. Dus ook geen `<style>` in `index.html` en geen `style="…"` in HTML-tekst (wel Svelte's `style:`).
- **Meten in de ontwikkelfase:** bij elke uitspraak worden appversie (commit), model, promptversie (hash), de meegestuurde context en de tijden per stap bewaard (wachtrij, verzoek, tijd bij Anthropic), plus of de app op de achtergrond stond. Een gebeurtenissenlog (tabel `events`) bewaart fouten, mislukte pogingen, voor-/achtergrond, online/offline en GPS. Dit alles gaat mee in de JSON-export (scherm Developer, `#developer`: alleen in het menu van de eigenaar, met ook de feedback van alle testers, de kosten, de JSON-import en testers uitnodigen) en bij het delen (hieronder).
- **Kosten:** de proxy telt bij elk verzoek aan OpenAI en Anthropic het verbruik (tokens uit het `usage`-blok, bij `whisper-1` seconden audio) per dag, tester, omgeving, wandeling (header `X-Session` van de app; de testset zonder) en model, in D1 (binding `USAGE`, `worker/usage.ts`; geen KV, want die kan niet veilig optellen en heeft weinig schrijfacties). De kaart Kosten op Developer (`/api/usage`, alleen de eigenaar) rekent het met de prijstabel in `src/lib/costs.ts` om naar dollars: vandaag, deze en vorige maand, per tester en de duurste wandelingen. Prijzen veranderen: de tabel heeft een datum en bron. Ter controle staat ernaast de echte rekening van deze maand (`/api/billing`, `worker/billing.ts`): de Costs API van OpenAI en de Cost API (Admin API) van Anthropic, elk met een eigen beheersleutel als geheim in de proxy (`OPENAI_ADMIN_KEY`, `ANTHROPIC_ADMIN_KEY`, optioneel; de Admin API van Anthropic werkt alleen met een organisatie, niet met een persoonlijk account). Alleen de kosten van Fluistervink: het OpenAI-project `OPENAI_PROJECT_ID` en de Anthropic-workspace `ANTHROPIC_WORKSPACE_ID` (vars in `wrangler.jsonc`, voor beide omgevingen; zonder id de hele organisatie, dus ook andere projecten). De proxy bewaart de rekening een uur in KV (`TESTERS`), en Developer vergelijkt vanaf de eerste getelde dag van de maand.
- **Delen met de ontwikkelaar:** gestopte wandelingen (uitspraken, transcripten, LLM-uitvoer, nagelopen waarnemingen, prullenbak, feedback en het log van die periode) gaan automatisch naar de proxy, die ze per tester in KV bewaart (`/api/feedback`, binding `FEEDBACK`). Opnieuw na een wijziging (hash per wandeling), bv. na het nalopen; mislukt het, dan bij de volgende gelegenheid (opstarten, schermwissel, weer online). Alleen na toestemming: het hoofdscherm vraagt het één keer (ook aan wie de app al had), daarna aan/uit bij Instellingen (`src/lib/ShareSettings.svelte`). Opnames alleen als de gebruiker dat apart aanzet. Alleen de eigenaar kan ophalen: `npm run feedback -- pull` zet per tester een export in `testset/feedback/<tester>.json`, direct bruikbaar voor `npm run testset`; `npm run feedback -- notes` toont de nieuwe feedback (`--alle`: ook verwerkte) en `npm run feedback -- verwerkt` markeert die daarna als verwerkt (ook op het scherm Developer, waar de eigenaar de feedback van alle testers leest; `/api/feedback/notes`, verwerkte id's in KV `TESTERS`). Verwerkt verbergt alleen; de gedeelde wandelingen blijven (testset), samengevat in `NOTES.md`. `npm run feedback -- wipe <tester>` wist alles van een tester (online en lokaal). Zie `src/lib/share.ts` en `scripts/feedback.mjs`.
- **Privacy:** pagina `#privacy` (`src/lib/Privacy.svelte`, in het menu) legt uit wat waarheen gaat (OpenAI, Anthropic, waarneming.nl, OpenStreetMap-kaarttegels, gedeelde gegevens) en wat de gebruiker zelf kan. Houd die gelijk met de code bij elke nieuwe plek waar gegevens heen gaan; het beleid van de aanbieders staat er met bron en datum. Workers Logs zonder invocation logs (die bevatten het adres, bij `/api/area` met coördinaten).
- **Uitleg:** pagina `#uitleg` ("Hoe werkt het?", `src/lib/HowItWorks.svelte`, in het menu en gelinkt vanuit het welkom): inspreken, verbeteren, trilpatronen, thuis nalopen, feedback, en open over wat AI doet en niet kan. Zonder technische termen. Houd trilpatronen en voorbeelden gelijk met de code.
- **Toegang:** de proxy eist een geheime toegangscode. `ACCESS_CODE` is die van de eigenaar; testers krijgen elk een eigen code in `ACCESS_CODES` (JSON, naam → code), zodat je er één kunt afsluiten en per tester het gebruik ziet (Workers Logs). Beheer met `npm run tester` (`scripts/tester.mjs`), of vanuit de app: op het scherm Developer naam en e-mailadres invullen; de proxy maakt een code (KV `TESTERS`, `/api/testers`, alleen de eigenaar) en daarna opent een knop de mail-app met de uitnodiging (`mailto:`, vanaf het eigen adres; het e-mailadres wordt niet bewaard; een aparte knop omdat Chrome op Android een andere app alleen direct na een tik opent). Daar ook de lijst van testers en afsluiten. De code komt binnen via een uitnodigingslink (`https://…/#code=…`; na het `#`, dus niet naar de server of in logs) of wordt bij Instellingen ingevuld (Android-app uit Play: de mail geeft de deelnamelink van de test en de code los, `src/lib/invite.ts`, want de link opent in Chrome; App Links later, zie `docs/google-play.md`), en staat daarna in localStorage. Na de link toont het hoofdscherm een welkom (of een melding als de code niet werkt). De naam van de tester gaat mee in de JSON-export en de feedback. Geen accounts.
- **Hosting:** een Cloudflare Worker met static assets: serveert de app én de `/api`-routes (één URL per omgeving; HTTPS is vereist voor microfoon en GPS). Automatisch deployen vanuit GitHub via Workers Builds.
- **Twee omgevingen** (`docs/omgevingen.md`): de **beta** (branch `main`, `fluistervink.stephanmullernl.workers.dev`, voor testers, label "beta" in de app) en de **stabiele** versie (branch `stable`, `fluistervink.nl`, Worker `fluistervink-stable` uit `env.stable` in `wrangler.jsonc`, bouwen met `npm run build:stable`). Bijwerken met `npm run release` (`scripts/release.mjs`: toont wat er meegaat en de laatste kwaliteitsronde, vraagt het eerst, en zet `stable` vooruit naar `origin/main`); fixes dus altijd via `main`. KV en geheimen zijn gedeeld (één toegangscode, één feedback-pull); gedeelde wandelingen en exports hebben een veld `channel`. In de code: `CHANNEL` in `src/lib/log.ts`. In Play: één app, de beta-AAB naar de interne test, de stabiele naar de gesloten test (later productie); de workflow bouwt bij elke tag beide.

## MVP-scope

Doel: valideren dat herkenning en interpretatie in het veld goed genoeg werken.

**Wel in de MVP:**

- Sessie starten en stoppen
- Push-to-talk-knop in de interface (scherm aan)
- Opname → Whisper → LLM met tools → waarneming(en)
- Tijd en GPS bij start van de opname
- Local-first opslag en sequentiële verwerking in IndexedDB
- Trilfeedback
- Overzichtslijst met eenvoudig bewerken (soort, aantal, gedrag, verwijderen)
- CSV-export voor de bulkimport van waarneming.nl
- Kaart in de review van een wandeling (alleen bekijken): waar is wat gezien (Leaflet + OpenStreetMap). Stippen die overlappen worden een bolletje met het aantal (`leaflet.markercluster`); tikken opent bij ≤ 5 waarnemingen een lijst, anders zoomt de kaart in
- Proxy voor API-sleutels
- Feedback (vroeger "dev notes"): een uitspraak die begint met "feedback" (of nog steeds "dev note") wordt geen waarneming maar een bevinding over de app (gaat niet naar het model). Als vangnet herkent het model opmerkingen over de app ook zonder dat voorvoegsel (tool `add_dev_note`; intern heet het nog `dev_note`). Op het Feedback-scherm ook te typen en te verwijderen; getypt buiten een wandeling is het "losse feedback" (`sessionId` leeg), die apart gedeeld wordt (`sessions/losse-feedback-<apparaat>`, per apparaat zodat de app en de PWA elkaars feedback niet overschrijven, met het log van het half uur ervoor). Los te lezen, als Markdown te kopiëren, en gaat mee bij het delen met de ontwikkelaar.
- Testset: van elke uitspraak de audio, het transcript, de LLM-uitvoer en de uiteindelijke (gecorrigeerde) waarneming bewaren, en kunnen exporteren. Bedoeld om STT-opties, prompts en modellen objectief te vergelijken.

**Bewust níet in de MVP (niet toevoegen zonder overleg):**

- Wake word (de native laag wel, zie `docs/plan-capacitor.md`)
- GPS-track (ook later niet gewenst) en locaties verslepen op de kaart
- Echte offline-ondersteuning (verwerken zodra er verbinding is, sync-status)
- Uploaden via de API van waarneming.nl
- Automatisch pauzeren als een andere app (zoals Merlin) de microfoon gebruikt
- Accounts, delen of multi-user

## Datamodel

- **Session:** id, start- en eindtijd, status, klaar voor export en geëxporteerd (tijdstippen), naam (gebied van waarneming.nl: bij de start dat van de startpositie, bij het stoppen dat met de meeste waarnemingen; met de hand aan te passen)
- **Utterance:** id, sessionId, tijdstip, lat/lon/nauwkeurigheid, audio, transcript, LLM-uitvoer, verwerkingsstatus
- **Observation:** id, sessionId, utteranceId (bron), soort-ID, aantal, telmethode, activiteit/gedrag (bv. overvliegend, ter plaatse, roepend, zingend), methode (gezien/gehoord), optioneel geslacht/leeftijd/kleed, tijdstip, lat/lon/nauwkeurigheid, `uncertain`, opmerking (voor waarneming.nl), eigen notitie (niet geëxporteerd), vlag "niet exporteren", status (concept / gereviewd / geëxporteerd)

Soort, activiteit, methode, kleed en telmethode worden opgeslagen als **waarneming.nl-ID's** (zie `data/` en `docs/waarneming-nl.md`). Die werken direct met de latere API; voor de CSV-export zet de app ze om naar wetenschappelijke naam en Engelse tekst.

## Openstaande punten

- **Mapping van gesproken termen naar velden:** eerste voorstel in `docs/waarneming-nl.md`, verfijnen met de testset.

Opgelost en vastgelegd: het importformaat van waarneming.nl (bulkimport, `docs/waarneming-nl.md`, getest op 11 okt), de soortenlijst (`scripts/fetch-species.mjs` → `data/soorten-nl.json`, bijnamen in `data/bijnamen.json`, beide in de systeemprompt) en de STT-keuze (`gpt-4o-transcribe`).

## Bouwvolgorde en mijlpaal

De zeven bouwstappen van de MVP zijn klaar: projectopzet, proxy, interpretatie met tools, opname met spraakherkenning, review, CSV-export en testset (`npm run testset -- <export.json>` haalt uitspraken opnieuw door spraakherkenning en model en scoort ze tegen de nagelopen waarnemingen, zie `scripts/testset.mjs`).

**Mijlpaal:** de MVP is geslaagd als na drie à vier echte wandelingen het grootste deel van de waarnemingen zonder correctie correct is en spraakcorrecties ("nee, keep") betrouwbaar werken. Beoordeeld op 12 okt: gehaald (88% zonder correctie goed, correcties met de stem 9 van de 10), zie `docs/mijlpaal-mvp.md`. Volgende stap: de native laag, zie `docs/plan-capacitor.md`.

## Latere roadmap

- Wake word "Fluistervink" (bv. Porcupine of openWakeWord), na de native laag
- Automatisch pauzeren en hervatten als een andere app de microfoon gebruikt (AudioRecordingCallback)
- Locaties verslepen op de kaart in de review
- Offline wachtrij met sync-status
- Upload via de API van waarneming.nl (OAuth; client-ID aanvragen bij Observation.org)
- Eventueel: BirdNET on-device voor soortsuggesties

## Werkafspraken

- Werk in kleine stappen: één feature per branch en pull request, met een duidelijke beschrijving.
- De eigenaar programmeert zelf weinig maar heeft een front-end-achtergrond (JavaScript): leg keuzes kort uit in de PR-beschrijving.
- Houd dit bestand actueel wanneer ontwerpkeuzes veranderen.
- Tests: `npm test` (Vitest, `src/**/*.test.ts` en `worker/index.test.ts`), met een database in het geheugen (fake-indexeddb), een nagebootst model en voor de proxy een nep-KV en nagebootste `fetch`; nooit echte API-aanroepen. Bij elke PR draaien de opmaakcheck, `check`, de tests, een proefbuild en `npm audit --omit=dev` in GitHub Actions (`.github/workflows/check.yml`). Nieuwe logica in de wachtrij, de validatie van het model, de export of de proxy krijgt een test.
- Opmaak: Prettier (`.prettierrc`, met de Svelte-plugin; Markdown, `data/` en `testset/` niet). Voor het committen `npm run format`; de grote opmaakcommit staat in `.git-blame-ignore-revs`.
- Kwaliteitsronde (`docs/kwaliteitsronde.md`): direct na een release naar stable, op de beta, de hele codebase na (security-review, code-review en simplify, toegankelijkheid en UX, `veldtest-review`, `#privacy` en `#uitleg` tegen de code), met een regel in het logboek daar. Ook vóór een nieuwe groep gebruikers of als gegevens een nieuwe kant op gaan. Daarnaast bij elke PR `npm audit` op de pakketten die meegaan, en Dependabot (`.github/dependabot.yml`) elke maandag.
- Veldtest: de skill `veldtest-review` (`.claude/skills/veldtest-review/`) bekijkt de app als vogelaar met één hand, handschoenen, in de zon en bij slecht bereik, meet knoppen en contrast in de browser (`scripts/meet.js`), bootst netwerkstoringen na (`scripts/netwerk.js`) en lost de duidelijke problemen op. Gebruik hem na wijzigingen aan het wandelscherm en vóór een wandeling onder bijzondere omstandigheden.
- `NOTES.md` is het werklog om tussen computers te schakelen: lees het aan het begin van een sessie, werk het bij aan het eind. Kleine notitie- en documentatiewijzigingen zoals deze mogen direct op `main`, zonder branch of PR.
