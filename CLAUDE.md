# Thijsse — spraakgestuurde vogelwaarnemingen

Thijsse is een app waarmee je tijdens het vogelen waarnemingen inspreekt ("Thijsse, zes overvliegende houtduiven", "roepje vink"). De app legt tijd en locatie vast, zet de uitspraak om in een gestructureerde waarneming, en maakt export naar waarneming.nl mogelijk.

Vernoemd naar Jac. P. Thijsse. "Thijsse" is ook het (toekomstige) wake word.

## Werkwijze in het veld

1. App openen → sessie (= één wandeling) start. Een duidelijke knop "stop wandeling" beëindigt de sessie.
2. Iets gezien of gehoord → knop indrukken (MVP) of later het wake word "Thijsse" zeggen, en de waarneming inspreken.
3. Elke uitspraak wordt verwerkt en verschijnt in het overzicht. Bevestiging via trillen, zodat de gebruiker niet naar het scherm hoeft te kijken.
4. Correcties kunnen in het veld met de stem: "nee, keep in plaats van vink", "nog drie erbij", "die laatste weg".
5. Thuis: review van soort, aantal, gedrag en locatie, nalopen van onzekere waarnemingen, audio terugluisteren.
6. Inzenden naar waarneming.nl (MVP: CSV-export; later via de API).

## Vastgelegde ontwerpkeuzes

- **Doelgroep:** persoonlijk gebruik, recreatief vogelen op wandelingen. Geen professionele inventarisatieprotocollen.
- **Front-end-stack:** Vite, Svelte 5 met TypeScript, Dexie (IndexedDB), vite-plugin-pwa. Gekozen omdat Svelte-runes en -templates dicht bij de Angular-ervaring van de eigenaar liggen, met weinig boilerplate.
- **Platform:** Android. Start als PWA (Chrome op Android); later in Capacitor verpakken met een native Kotlin-plugin voor wake word en achtergrondaudio. Houd de webcode daarom platformonafhankelijk.
- **Spraak naar tekst:** Whisper via de API van OpenAI (`gpt-4o-transcribe`, `gpt-4o-mini-transcribe` of `whisper-1`), met een soortenlijst in de prompt om herkenning van soortnamen te verbeteren. Vergelijken met de Web Speech API op basis van de testset (zie hieronder).
- **Interpretatie:** een LLM (klein en snel model, bv. Claude Haiku) met tool use. Het model geeft acties terug, de app voert ze uit:
  - `add_observation`, `update_observation`, `delete_observation`, `undo`
  - Context per aanroep: de laatste waarnemingen van de huidige sessie, zodat verwijzingen als "die", "de vorige" en "nog drie" werken.
  - Soorten alleen via ID's uit een vaste soortenlijst (Nederlandse vogels, in de systeemprompt, met prompt caching). De app valideert elk soort-ID; het model kan geen soorten verzinnen.
  - Bij twijfel zet het model een `uncertain`-vlag in plaats van terug te vragen. Uitspraken zonder waarneming worden genegeerd.
- **Tijd en locatie:** vastleggen op het moment dat de opname start, inclusief GPS-nauwkeurigheid. Tijdens een wandeling blijft de GPS warm (`watchPosition`), zodat er bij een uitspraak direct een nauwkeurige positie is; is die ouder dan 15 s (bv. bij stilstaan), dan vraagt de app een verse meting. Lukt dat niet, dan de laatst bekende positie, hoe oud ook (lang stilstaan bij een hut of vogelscherm komt vaak voor); de meettijd blijft bewaard, zodat de leeftijd in de review zichtbaar is. Tussenliggende posities worden niet bewaard (geen GPS-track). De uitspraak wacht niet op de GPS: komt de positie later binnen, dan krijgen de waarnemingen hem alsnog.
- **Local-first:** elke uitspraak (audio, tijd, GPS) wordt eerst lokaal opgeslagen (IndexedDB) en daarna verwerkt, één voor één, op volgorde. Dit is in feite een wachtrij die normaal direct leeg is; echte offline-ondersteuning kan later met weinig moeite worden toegevoegd.
- **Feedback:** trilpatronen. Eén korte tril = opgeslagen; twee = niet begrepen; een afwijkend patroon = opgeslagen maar onzeker.
- **API-sleutels:** nooit in de client. Een kleine proxy (`worker/index.ts`) praat met de STT- en LLM-API's: `/api/transcribe` (OpenAI) en `/api/messages` (Anthropic, doorgeefluik met een lijst toegestane modellen). De app stelt prompt en tools zelf samen.
- **Meten in de ontwikkelfase:** bij elke uitspraak worden appversie (commit), model, promptversie (hash), de meegestuurde context en de tijden per stap bewaard (wachtrij, verzoek, tijd bij Anthropic), plus of de app op de achtergrond stond. Een gebeurtenissenlog (tabel `events`) bewaart fouten, mislukte pogingen, voor-/achtergrond, online/offline en GPS. Alles blijft lokaal en gaat mee in de JSON-export.
- **Toegang:** de proxy eist een geheime toegangscode (`ACCESS_CODE`), die de gebruiker één keer in de app invult. Geen accounts.
- **Hosting:** één Cloudflare Worker met static assets: serveert de app én de `/api`-routes (één project, één URL; HTTPS is vereist voor microfoon en GPS). Automatisch deployen vanuit GitHub via Workers Builds.

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
- Proxy voor API-sleutels
- Dev notes: een uitspraak die begint met "dev note" wordt geen waarneming maar een bevinding over de app (gaat niet naar het model). Los te lezen en als Markdown te kopiëren, om door te geven aan een ontwikkelsessie.
- Testset: van elke uitspraak de audio, het transcript, de LLM-uitvoer en de uiteindelijke (gecorrigeerde) waarneming bewaren, en kunnen exporteren. Bedoeld om STT-opties, prompts en modellen objectief te vergelijken.

**Bewust níet in de MVP (niet toevoegen zonder overleg):**

- Wake word en achtergrondgebruik met het scherm uit
- Capacitor of native code
- GPS-track en kaartweergave
- Echte offline-ondersteuning (verwerken zodra er verbinding is, sync-status)
- Uploaden via de API van waarneming.nl
- Automatisch pauzeren als een andere app (zoals Merlin) de microfoon gebruikt
- Accounts, delen of multi-user

## Datamodel (eerste schets)

- **Session:** id, start- en eindtijd, status
- **Utterance:** id, sessionId, tijdstip, lat/lon/nauwkeurigheid, audio, transcript, LLM-uitvoer, verwerkingsstatus
- **Observation:** id, sessionId, utteranceId (bron), soort-ID, aantal, telmethode, activiteit/gedrag (bv. overvliegend, ter plaatse, roepend, zingend), methode (gezien/gehoord), optioneel geslacht/leeftijd/kleed, tijdstip, lat/lon/nauwkeurigheid, `uncertain`, status (concept / gereviewd / geëxporteerd)

Soort, activiteit, methode, kleed en telmethode worden opgeslagen als **waarneming.nl-ID's** (zie `data/` en `docs/waarneming-nl.md`). Die werken direct met de latere API; voor de CSV-export zet de app ze om naar wetenschappelijke naam en Engelse tekst.

## Openstaande punten

- **Importformaat van waarneming.nl:** opgelost, zie `docs/waarneming-nl.md`. Waarneming.nl heeft een eigen bulkimport (CSV) met velden voor activiteit, methode, kleed, telmethode, geslacht, zekerheid en een uuid tegen dubbel invoeren. Gedrag en methode gaan als tekst in de taal van de site; de app exporteert Engels.
- **Soortenlijst:** opgelost. `scripts/fetch-species.mjs` haalt de lijst op bij de openbare API van waarneming.nl → `data/soorten-nl.json` (343 soorten met waarneming.nl-ID's). Bijnamen en afkortingen uit vogelaarsjargon ("tova", "robotap", "KBV") staan in `data/bijnamen.json` (bijnaam → soort-ID) en gaan mee in de systeemprompt; vrij aan te vullen.
- **STT-keuze:** Whisper tegenover Web Speech API, beslissen op basis van de testset.
- **Mapping van gesproken termen naar velden:** eerste voorstel in `docs/waarneming-nl.md`, verfijnen met de testset.

## Voorgestelde bouwvolgorde

1. Projectopzet: PWA-skelet, IndexedDB, sessies, deploy naar Cloudflare. *(klaar)*
2. Proxy (Cloudflare Worker) voor de API-sleutels. *(klaar)*
3. LLM-interpretatie met tools, eerst getest met tekstinvoer (zonder spraak). *(klaar)*
4. Opname en Whisper-koppeling, met tijd en GPS bij start van de opname. *(klaar: knop tikken of vasthouden, `gpt-4o-transcribe` met soortnamen en bijnamen in de prompt)*
5. Review: trilfeedback, afgelopen wandelingen kunnen openen, overzichtslijst met bewerken (soort, aantal, gedrag, verwijderen), onzekere waarnemingen nalopen, audio terugluisteren. *(klaar, plus gebiedsnaam van waarneming.nl bij elke waarneming in PR #18)*
6. CSV-export voor waarneming.nl. *(klaar: bulkimport van waarneming.nl in PR #19; eerste echte import nog testen)*
7. Opslaan en exporteren van de testset. Bewust na de CSV-export: de testset wordt pas nuttig na een paar wandelingen, en de gegevens ervoor (audio, transcript, LLM-uitvoer, gecorrigeerde waarneming) worden vanaf stap 4 al bewaard.

## Wanneer is de MVP geslaagd?

Na drie à vier echte wandelingen is het grootste deel van de waarnemingen zonder correctie correct, en werken spraakcorrecties ("nee, keep") betrouwbaar. Pas dan investeren in de native laag (Capacitor, wake word "Thijsse", achtergrondgebruik).

## Latere roadmap

- Capacitor met een native Kotlin-plugin: foreground service met microfoon, wake word "Thijsse" (bv. Porcupine of openWakeWord)
- Automatisch pauzeren en hervatten als een andere app de microfoon gebruikt (AudioRecordingCallback)
- GPS-track tijdens de sessie en een kaart in de review om locaties te verslepen
- Offline wachtrij met sync-status
- Upload via de API van waarneming.nl (OAuth; client-ID aanvragen bij Observation.org)
- Eventueel: BirdNET on-device voor soortsuggesties
- Flow en indeling: hoofdscherm, menu (instellingen, vorige wandelingen), wandeling met locatienaam, reviewscherm met kaart vóór de export. Zie `docs/ideeen-flow.md`.

## Werkafspraken

- Werk in kleine stappen: één feature per branch en pull request, met een duidelijke beschrijving.
- De eigenaar programmeert zelf weinig maar heeft een front-end-achtergrond (JavaScript): leg keuzes kort uit in de PR-beschrijving.
- Houd dit bestand actueel wanneer ontwerpkeuzes veranderen.
- `NOTES.md` is het werklog om tussen computers te schakelen: lees het aan het begin van een sessie, werk het bij aan het eind. Kleine notitie- en documentatiewijzigingen zoals deze mogen direct op `main`, zonder branch of PR.
