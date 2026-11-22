# Fluistervink — spraakgestuurde vogelwaarnemingen

Fluistervink is een app waarmee je tijdens het vogelen waarnemingen inspreekt ("Fluistervink, zes overvliegende houtduiven", "roepje vink"). De app legt tijd en locatie vast, zet de uitspraak om in een gestructureerde waarneming, en maakt export naar waarneming.nl mogelijk.

De naam is een woordgrap op "luistervink": je fluistert je waarnemingen in, en de vink is de vogel die je het vaakst inspreekt. "Fluistervink" is ook het (toekomstige) wake word. Tot oktober 2026 heette de app Thijsse (naar Jac. P. Thijsse).

Dit bestand geeft de keuzes kort; de uitwerking per onderwerp, met de plekken in de code, staat in `docs/ontwerp.md`. Houd beide gelijk met de code.

## Werkwijze in het veld

1. Sessie starten (= één keer vogelen: een wandeling, een fietstocht, een uur in een vogelhut of in de tuin). Een duidelijke knop "Stop" beëindigt de sessie; vergeten te stoppen vangt de app op (`checkStaleSession`).
2. Iets gezien of gehoord → knop indrukken (MVP) of later het wake word "Fluistervink" zeggen, en de waarneming inspreken.
3. Elke uitspraak wordt verwerkt en verschijnt in het overzicht. Bevestiging via trillen, zodat de gebruiker niet naar het scherm hoeft te kijken.
4. Correcties kunnen in het veld met de stem: "nee, keep in plaats van vink", "nog drie erbij", "die laatste weg".
5. Thuis: review van soort, aantal, gedrag en locatie, nalopen van onzekere waarnemingen (één voor één, daarna "Alles klopt") en van wat niet begrepen is, audio terugluisteren.
6. Een nagelopen sessie zet je "klaar voor waarneming.nl"; alle klaarstaande sessies gaan in één bestand naar de bulkimport van waarneming.nl (CSV, in de Android-app xlsx). Later via de API.

## Vastgelegde ontwerpkeuzes

- **Doelgroep:** persoonlijk gebruik, recreatief vogelen, waar dan ook: lopend, op de fiets, in een vogelhut of de tuin. Geen professionele inventarisatieprotocollen.
- **Front-end-stack:** Vite, Svelte 5 met TypeScript, Dexie (IndexedDB), vite-plugin-pwa. Gekozen omdat Svelte-runes en -templates dicht bij de Angular-ervaring van de eigenaar liggen, met weinig boilerplate.
- **Platform:** Android. Begonnen als PWA (werkt ook in Safari op een iPhone, zonder trillen); nu in Capacitor verpakt (`docs/plan-capacitor.md`). De app laadt de webcode live van de site (`server.url`), zodat een gemergde PR meteen ook in de app staat; alleen native wijzigingen vragen een nieuwe app-versie (tag `v0.*`, `docs/google-play.md`). Een toestemming waarvoor Google een verklaring wil, staat eerst alleen in de beta-build; de stabiele haalt hem eruit (`android/app/src/stable/AndroidManifest.xml`). De verklaring zelf is dan toch nodig (die geldt voor de hele app). Native functies alleen via `src/lib/native.ts`, met de web-API's als terugval: de PWA blijft werken, dus houd de webcode platformonafhankelijk.
- **Spraak naar tekst:** OpenAI `gpt-transcribe` (gekozen op de testset), met een soortenlijst in de prompt.
- **Interpretatie:** een LLM (klein en snel model, bv. Claude Haiku) met tool use. Het model geeft acties terug, de app voert ze uit:
  - `add_observation`, `update_observation`, `delete_observation`, `undo`, `redo`.
  - Context per aanroep: de laatste waarnemingen van de huidige sessie, zodat verwijzingen als "die", "de vorige" en "nog drie" werken.
  - Soorten alleen via ID's uit een vaste soortenlijst in de systeemprompt (vogels, en standaard ook andere diergroepen; met wetenschappelijke naam). De app valideert elk soort-ID; het model kan geen soorten verzinnen. Dwaalgasten staan niet in de prompt maar zoekt de app op (`findVagrant`), altijd onzeker.
  - Bij twijfel zet het model een `uncertain`-vlag in plaats van terug te vragen; bij twijfel tussen twee of drie soorten bewaart de app de kandidaten. Uitspraken zonder waarneming worden genegeerd.
  - Een uitspraak die begint met "feedback" is een bevinding over de app, geen waarneming.
- **Taal:** Nederlands. Engels (scherm én inspreken) eerst als ontwikkeloptie "English" (`docs/plan-engels.md`): elke uitspraak bewaart zijn taal (`Utterance.language`), met een eigen Engelse prompt voor spraakherkenning en model (`src/lib/promptEn.ts`) en eigen promptversies. Een verbetering aan de ene prompt hoort ook in de andere; de Nederlandse prompt verandert niet door het Engels. Uitleg en privacy hebben per taal een eigen pagina (`HowItWorks.en.svelte`, `Privacy.en.svelte`, ook `/privacy-en`); een wijziging aan de ene hoort in dezelfde PR in de andere.
- **Tijd en locatie:** vastleggen op het moment dat de opname start, met GPS-nauwkeurigheid. De GPS blijft warm tijdens een sessie; de uitspraak wacht niet op de GPS, een plek die later komt gaat er alsnog bij. Geen GPS-track, wel de afgelegde afstand (voor eBird, alleen als de gebruiker dat aanzet). De plek is thuis met de hand te verzetten, en een plek in de uitspraak ("500 m zuid") rekent de app zelf uit; het model geeft alleen door wat er gezegd is.
- **Trektelmodus** (`docs/plan-trektelmodus.md`): voor wie op één plek telt met de telefoon naast zich. De microfoon blijft aan en de app knipt de opname in stukken van ongeveer een minuut, elk een gewone uitspraak. Naar een andere app of scherm op slot pauzeert hij. Proef in de beta (ontwikkeloptie scherm uit): de service neemt de telling op en knipt zelf, het scherm mag uit, en alleen een andere app die de microfoon pakt pauzeert hem. De proxy heeft per installatie per dag een plafond voor spraak en voor het model; daarboven stopt een trektelling met uitleg.
- **Instellingen en ontwikkelopties:** keuzes voor iedereen bij Instellingen (`src/lib/preferences.ts`). Nieuwe functies eerst alleen bij de eigenaar als ontwikkeloptie (`src/lib/devOptions.ts`, standaard uit), tot ze bevallen.
- **Local-first:** elke uitspraak (audio, tijd, GPS) wordt eerst lokaal opgeslagen (IndexedDB) en daarna verwerkt, één voor één, op volgorde (`src/lib/queue.ts`). Zonder bereik wacht de wachtrij tot er weer verbinding is en gaat dan op volgorde door, zodat correcties als "nee, keep" blijven kloppen (`docs/plan-offline.md`). Fouten waar wachten niet helpt, mislukken met "Opnieuw"; niets gaat stil verloren. Omdat alles alleen op de telefoon staat, is er een back-up bij Instellingen.
- **Vormgeving:** eenvoudig en rustig (inspiratie: vogelchecklist.nl), in de kleuren van de mannetjesvink: blauwgrijs als hoofdkleur, roze-oranje als accent (opnemen, stoppen, verwijderen), lichte achtergrond, witte kaarten. Kleuren en gedeelde bouwstenen in `src/app.css`, gedeelde opmaak in `src/lib/format.ts`. Zeldzaamheid met de kleuren van waarneming.nl plus een vorm per niveau. Geen webfont (offline).
- **Feedback:** trilpatronen. Eén korte tril = opgeslagen; twee = niet begrepen; kort, lang = opgeslagen maar onzeker; lang, kort = bewaard, wacht op bereik (na meer dan een minuut wachten één korte tril als alles binnen is); drie korte = mislukt (`src/lib/feedback.ts`).
- **API-sleutels:** nooit in de client. Een kleine proxy (`worker/index.ts`, `docs/proxy.md`) praat met OpenAI (`/api/transcribe`) en Anthropic (`/api/messages`); hij laat alleen de modellen, velden en tools door die de app gebruikt, met plafonds per installatie, zodat toegang geen vrije toegang tot het tegoed is. De app stelt prompt en tools zelf samen.
- **Beveiliging in de app:** een JSON-import kan van een tester komen en wordt gecontroleerd op typen (`checkImport` in `src/lib/export.ts`). Gebruik geen `innerHTML` met gegevens uit de database zonder escapen; liever DOM-elementen. `public/_headers` zet een Content-Security-Policy (alleen scripts en stijlen van de eigen site, plus Cloudflare Turnstile; kaarttegels van OpenStreetMap); een nieuwe externe bron moet daar ook bij. Dus ook geen `<style>` in `index.html` en geen `style="…"` in HTML-tekst (wel Svelte's `style:`).
- **Meten in de ontwikkelfase:** bij elke uitspraak worden appversie, model, promptversie, context en tijden per stap bewaard, en een gebeurtenissenlog (tabel `events`) houdt fouten, netwerk en GPS bij. Dat gaat mee in de JSON-export (scherm Developer, alleen voor de eigenaar) en bij het delen. De proxy telt het verbruik per verzoek in D1; Developer en Statistieken (alleen de eigenaar, alleen totalen) rekenen het om.
- **Delen met de ontwikkelaar:** gestopte sessies (met feedback en log) gaan na toestemming automatisch naar de proxy; opnames alleen als de gebruiker dat apart aanzet. Alleen de eigenaar haalt op (`npm run feedback`).
- **Privacy:** pagina `#privacy` (`src/lib/Privacy.svelte`, ook als losse pagina `/privacy` voor Google Play; Engels in `Privacy.en.svelte`) legt uit wat waarheen gaat en wat de gebruiker zelf kan. Houd die gelijk met de code bij elke nieuwe plek waar gegevens heen gaan.
- **Uitleg:** pagina `#uitleg` (`src/lib/HowItWorks.svelte`, Engels in `HowItWorks.en.svelte`), zonder technische termen; houd trilpatronen en voorbeelden gelijk met de code. Nieuwelingen krijgen een welkom in stappen, met "Probeer het eens" (één zin inspreken, er wordt niets bewaard).
- **Toegang:** geen accounts, geen e-mailadres en geen code nodig (`docs/plan-laagdrempelig.md`). De app meldt zich onzichtbaar aan als installatie met Play Integrity of Turnstile; alleen de eigenaar heeft een code.
- **Hosting:** een Cloudflare Worker met static assets: serveert de voorpagina (`/`, `index.html`), de app (`/app/`, `app/index.html`) én de `/api`-routes (één adres per omgeving; HTTPS is vereist voor microfoon en GPS). Wie de app al gebruikt (Android-app, geïnstalleerde PWA, oude link met `#`), gaat van `/` meteen door naar `/app/` (`public/naar-app.js`); de gegevens horen bij het adres, niet bij het pad. Automatisch deployen vanuit GitHub via Workers Builds.
- **Twee omgevingen** (`docs/omgevingen.md`): de **beta** (branch `main`) en de **stabiele** versie (branch `stable`, `fluistervink.nl`), bijwerken met `npm run release`. Nieuwe functies gaan naar `main`, het liefst achter een ontwikkeloptie, zodat `main` altijd naar stabiel kan; fixes dus via `main`, een hotfix naar `stable` alleen als `main` iets heeft dat nog niet mee mag. In Play: de beta-AAB naar de interne test, de stabiele naar de gesloten test (later productie).

## MVP-scope

Doel: valideren dat herkenning en interpretatie in het veld goed genoeg werken. Gehaald op 12 okt (88% zonder correctie goed, correcties met de stem 9 van de 10; `docs/archief/mijlpaal-mvp.md`); de volgende stappen staan in `docs/roadmap.md`.

**Wel in de MVP:** sessie starten en stoppen; push-to-talk-knop vast onderaan in de duimzone; opname → spraakherkenning → LLM met tools → waarneming(en); tijd en GPS bij start van de opname; local-first opslag en verwerking op volgorde; trilfeedback; overzichtslijst met eenvoudig bewerken; CSV-export voor de bulkimport van waarneming.nl; kaart in de review (alleen bekijken); locatie met de hand aanpassen; plek van de vogel in de uitspraak; proxy voor API-sleutels; feedback; testset (`npm run testset`, `scripts/testset.mjs`: uitspraken opnieuw door spraakherkenning en model, gescoord tegen de nagelopen waarnemingen).

**Bewust níet in de MVP (niet toevoegen zonder overleg):**

- Wake word (gepland na v1.0, `docs/roadmap.md`)
- GPS-track (ook later niet gewenst)
- Uploaden via de API van waarneming.nl
- Automatisch pauzeren als een andere app (zoals Merlin) de microfoon gebruikt (behalve de trektelling, die pauzeert als de app naar de achtergrond gaat)
- Accounts, delen of multi-user

## Datamodel

- **Session:** id, start- en eindtijd, status, inspanning (duur en afstand), checklist voor eBird, klaar voor export en geëxporteerd (tijdstippen, ook voor eBird), naam (gebied van waarneming.nl; met de hand aan te passen)
- **Utterance:** id, sessionId, tijdstip, lat/lon/nauwkeurigheid, audio, transcript, LLM-uitvoer, verwerkingsstatus
- **Observation:** id, sessionId, utteranceId (bron), soort-ID, aantal, telmethode, activiteit/gedrag, methode (gezien/gehoord), optioneel geslacht/leeftijd/kleed, tijdstip, lat/lon/nauwkeurigheid (bij een verzette plek ook de oorspronkelijke GPS-positie), `uncertain` (met eventueel kandidaat-soorten), opmerking (voor waarneming.nl), eigen notitie (niet geëxporteerd), vlag "niet exporteren", status (concept / gereviewd / geëxporteerd)

Soort, activiteit, methode, kleed en telmethode worden opgeslagen als **waarneming.nl-ID's** (`data/`, `docs/waarneming-nl.md`). Die werken direct met de latere API; voor de CSV-export zet de app ze om naar wetenschappelijke naam en Nederlandse tekst. Openstaand: de mapping van gesproken termen naar velden verfijnen met de testset.

## Roadmap en documentatie

De richting staat in `docs/roadmap.md`, ideeën die nog geen plan zijn in `docs/ideeen.md`, een overzicht van alle documenten met de status van elk plan in `docs/README.md`. Een nieuw plan wordt `docs/plan-<onderwerp>.md` en komt in die index; afgerond werk dat alleen nog geschiedenis is, gaat naar `docs/archief/`.

## Werkafspraken

- Werk in kleine stappen: één feature per branch en pull request, met een duidelijke beschrijving.
- **Licentie:** AGPL-3.0-only. De eigenaar wil de enige auteur blijven (dubbele licentie), dus nooit code van anderen overnemen: geen pull requests van anderen mergen, en een bijdrage alleen opnieuw bouwen vanuit de beschrijving, zonder hun code te kopiëren (`CONTRIBUTING.md`). Updates van Dependabot mogen wel.
- Teksten op het scherm in het woordenboek (`src/lib/i18n/nl.ts`, `t()`), als hele zinnen, en dezelfde sleutel in het Engels in `en.ts` (TypeScript meldt een vergeten tekst); namen van soorten en codes op het scherm via de `…Label`-functies in `vocab.ts`. Zie `docs/ontwerp.md`, Vormgeving.
- Changelog: elke PR die voor gebruikers iets zichtbaars verandert, zet in `src/lib/changelog.ts` een regel in gewone taal, onder de datum van de merge, bij het passende onderwerp. Geen ontwikkelopties of schermen van de eigenaar. Bij elke release naar stable de dagen van vóór de vorige release inkorten tot de hoofdzaken, zonder onderwerpen (`items`).
- De eigenaar programmeert zelf weinig maar heeft een front-end-achtergrond (JavaScript): leg keuzes kort uit in de PR-beschrijving.
- Houd dit bestand en `docs/ontwerp.md` actueel wanneer ontwerpkeuzes veranderen.
- Tests: `npm test` (Vitest), met een database in het geheugen (fake-indexeddb), een nagebootst model en voor de proxy een nep-KV en nagebootste `fetch`; nooit echte API-aanroepen. Bij elke PR draaien de opmaakcheck, `check`, de tests, een proefbuild en `npm audit --omit=dev` in GitHub Actions. Nieuwe logica in de wachtrij, de validatie van het model, de export of de proxy krijgt een test. Een test over de wachtrij of iets dat de app verstuurt, loopt de storingen in `STORINGEN` (`src/test-helpers.ts`) langs; edge cases: `docs/plan-robuustheid.md`.
- Opmaak: Prettier (Markdown, `data/` en `testset/` niet). Voor het committen `npm run format`.
- Kwaliteitsronde (`docs/kwaliteitsronde.md`): direct na een release naar stable, op de beta, de hele codebase na, met een regel in het logboek daar. Ook vóór een nieuwe groep gebruikers of als gegevens een nieuwe kant op gaan.
- Veldtest: de skill `veldtest-review` bekijkt de app als vogelaar met één hand, handschoenen, in de zon en bij slecht bereik. Gebruik hem na wijzigingen aan het sessiescherm en vóór een sessie onder bijzondere omstandigheden.
- `NOTES.md` is het werklog om tussen computers te schakelen: lees het aan het begin van een sessie, werk het bij aan het eind. Alleen wat nu speelt en wat nog moet; is iets af, dan eruit. Kleine notitie- en documentatiewijzigingen zoals deze mogen direct op `main`, zonder branch of PR.
