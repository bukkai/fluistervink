# Stand van zaken

Werklog om tussen computers te kunnen schakelen. Werk dit bij aan het eind van elke werksessie, vóór het pushen. Oudere bevindingen uit de veldtests staan in `docs/veldtests.md`, de beoordeling van de mijlpaal in `docs/mijlpaal-mvp.md`; wat er per PR gebeurde, staat in de PR's op GitHub.

## Waar ik ben (13 okt)

- Bouwstappen 1–7 uit `CLAUDE.md` klaar en gemerged (t/m PR #78). In productie op `fluistervink.stephanmullernl.workers.dev`, met één tester (Tim).
- **Mijlpaal MVP gehaald** (12 okt, `docs/mijlpaal-mvp.md`): 88% van de waarnemingen zonder correctie goed, correcties met de stem 9 van de 10 keer.
- **Spraakherkenning: `gpt-4o-transcribe` blijft** (testset 12 okt: 9/12, tegen `gpt-4o-mini-transcribe` 8/12 en `whisper-1` 7/12).
- **Export gebundeld** (PR #90, 13 okt): na het nalopen zet je een wandeling "klaar voor waarneming.nl"; op het scherm Wandelingen gaan alle klaarstaande wandelingen in één CSV. Bestaande wandelingen hebben nog geen "klaar": de nog niet geëxporteerde één keer klaarzetten.
- Uitgaven: bij OpenAI en Anthropic vooraf betaald tegoed met auto-reload uit; dat is de harde grens. Stand 11 okt: $0,36 die maand bij Anthropic, 97% uit de cache, ruwweg een tiende cent per uitspraak.

## Volgende stappen

1. Nog één wandeling van Tim en één van jezelf met de huidige versie; daarna Capacitor (trillen en achtergrond eerst, wake word later).
2. Bosuil uit de bus (12 okt) nog weghalen.
3. Bij elke nieuwe gedeelde wandeling `npm run feedback -- pull` en `npm run testset` draaien, eventueel ook met `--model claude-sonnet-5-5`.
4. Prompt verbeteren met wat de testset laat zien ("tortelduif"; soortnamen als "pijl", "vaaltje", "knoopgans"), telkens nagaan met de testset.
5. Later: kostenoverzicht per wandeling in het testset-script (uit het `usage`-blok van Anthropic, plus minuten audio voor OpenAI).

## Open punten

- **Tim vragen** wat hij bedoelde met de afgekapte feedback "de knop" (11 okt).
- **Tester uitnodigen vanuit Developer opende geen mail** (12 okt). Mogelijke oorzaak in `invite` (`src/lib/Developer.svelte`): de `mailto:` wordt pas geopend ná het wachten op `addTester`, en Chrome op Android opent externe apps soms alleen direct na een tik. Testen: welk toestel, gebeurt er niets of komt er een fout, lukt het met de link die het scherm daarna toont? Oplossing als het daaraan ligt: na het aanmaken een knop "Mail openen" (gewone `<a href="mailto:…">`).
- **Podcast pauzeert bij inspreken** (13 okt, in de auto via Bluetooth): pauze tijdens de opname, dan even verder, dan weer stil. Vermoeden: de microfoon zet Bluetooth in belmodus (HFP), en het terugschakelen naar muziek (A2DP) hapert. Trillen vraagt geen audio aan. Nog na te gaan: gebeurt het ook zonder Bluetooth, en helpt het om de microfoon van de telefoon te kiezen (`deviceId` uit `enumerateDevices`)? Anders oplossen in Capacitor (audiofocus zelf regelen).
- **Nieuwe versie pas laden als er geen wandeling loopt** (#65): op de telefoon nalopen (`update_deferred` / `update_applied` in het log).
- **Korte spookopnames:** een lange broekzakopname wordt onzeker (#76), een korte (zoals de Bosuil, 4 s) nog niet.
- **STT gaf één keer zelf antwoord** in plaats van te transcriberen ("Sorry, ik kan niet voldoen aan het verzoek …", 11 okt) en liet daarbij het woord "feedback" weg. Onschuldig, maar in de gaten houden.
- **Nocmig met een tijd:** "vannacht een waterral overvliegend, half 3 een roepje" krijgt de tijd van de uitspraak. Idee: optioneel tijdveld in `add_observation` (model krijgt datum en tijd mee, app rekent om).
- "Ongedaan maken" van een ongedaan-maken wordt niet ondersteund; een tweede "undo" gaat een uitspraak verder terug.
- Cloudflare-previews: vermoedelijk onthoudt Cloudflare het deploy-commando per branch vanaf de eerste build. Bij problemen: nieuwe branch maken.
- Een branch-regel op `main` met verplichte check kan niet: GitHub biedt dat niet voor privérepo's zonder Pro. De check draait wel bij elke PR.

## Ideeën voor later

Nog niet gepland; eerst overleggen.

- **Trillen zonder Touch feedback:** Chrome trilt alleen als Touch feedback van Android aan staat (uitleg en tip staan op `#uitleg`). Alternatief: een melding met trilpatroon via de service worker (werkt ook op de achtergrond), of Capacitor.
- **Twee omgevingen** vóór een echte release: stabiel op `fluistervink.heg-mus.nl`, beta blijft op workers.dev (testers zitten daar al).
  - Domein: DNS van heg-mus.nl staat bij TransIP; voor een Custom Domain moeten de nameservers naar Cloudflare (eerst alle records overnemen, vooral mail: MX, SPF, DKIM).
  - Tweede Worker (bv. `env.production` in `wrangler.jsonc`), deployt vanaf een branch `release`. Per omgeving eigen geheimen, KV en een omgevingskeuze in `npm run tester` / `npm run feedback`.
  - Gegevens zijn per adres (IndexedDB, geïnstalleerde PWA): overzetten via JSON-export/-import; nagaan dat prod een export van een nieuwere db-versie netjes weigert.
  - Beta herkenbaar maken: label en andere naam/kleur in het manifest.
- **Inzenden via de API van waarneming.nl** (uitgezocht 13 okt; de officiële documentatie op `waarneming.nl/api/docs/*.md` gaf ons een 403, dus gecontroleerd in de TypeScript-client [observation-js](https://github.com/robbeverhelst/observation-js); nog na te lopen in de documentatie, ingelogd):
  - De API kan wel waarnemingen invoeren (niet via het importformulier). `POST /api/v1/observations/create/` ("one-way sync") neemt een lijst waarnemingen en geeft per waarneming de URL of de fouten; een fout houdt de rest niet tegen; `external_id` voorkomt dubbel invoeren (bestaande wordt bijgewerkt). `create-single/` is voor één waarneming met foto's/geluid.
  - Velden passen op wat we bewaren: `species` (ID), `date`, `time`, `point` (GeoJSON of WKT), `accuracy`, `number`, `sex`, `activity`, `life_stage`, `method`, `counting_method`, `is_certain`, `notes`, `uuid`.
  - OAuth: `/api/v1/oauth2/authorize/` en `/api/v1/oauth2/token/` (authorization code of password grant, met client-ID en secret). Testomgeving: `waarneming-test.nl`.
  - Eerst een client-ID aanvragen via het contactformulier (concept in de sessie van 13 okt: app, nalopen vóór inzenden, vaste soortenlijst, 88% goed; vragen: inlogmethode, client secret, testaccount op waarneming-test.nl, `create/` met `external_id` en welke scope, redirect-URL). Daarna: account koppelen bij Instellingen, route `/api/waarneming` in de proxy (CORS, secret), knop "Inzenden" voor de klaarstaande wandelingen, ID/link van waarneming.nl bewaren, `#privacy` en `#uitleg` bijwerken.
- **Uploaden met een Playwright-script** (overwogen 13 okt, niet gebouwd): kan technisch (eigen browserprofiel, zelf inloggen, CSV uploaden op `/import/observations/`), maar werkt alleen op een computer, terwijl het importeren meestal op de telefoon gebeurt; de CSV moet dan via de proxy naar de computer en "geëxporteerd" terug. De import meldt de uitkomst pas per mail, en het breekt als de pagina verandert. De API is de betere weg.
- **Waarom makkelijk invoeren goed is voor citizen science** (voor README, een "Over"-scherm of een aanvraag bij waarneming.nl): meer en vollediger gegevens (ook algemene soorten), minder vertekening naar zeldzaamheden, tijd en GPS op het moment zelf, en meer mensen die meedoen.
- **Soortenstatistieken over alle gebruikers:** tellen per soort-ID wat het model koos, wat met de hand gecorrigeerd werd en wat het niet kon plaatsen, om de soortenlijst, bijnamen en STT-prompt bij te stellen. Kan in de proxy (Analytics Engine of D1); alleen geaggregeerd, en op `#privacy` vermelden. Pas relevant bij meer gebruikers; tot die tijd geeft de testset hetzelfde beeld.
- Foto koppelen aan een waarneming via tijd en locatie.
- Idee eigenaar (13 okt): stippen dicht bij elkaar overlappen op de kaart (`src/lib/ObservationMap.svelte`). Nu komen alleen waarnemingen met precies dezelfde positie (zelfde uitspraak) in één stip. Opties:
  1. **Clusteren met `leaflet.markercluster`** (de gangbare plugin, gebundeld via npm, dus geen probleem met de CSP): stippen die op het scherm overlappen worden één bolletje met een getal; tikken zoomt in tot ze los liggen; op het hoogste zoomniveau waaieren ze uit (spiderfy). Eigen icoon voor het cluster: het aantal waarnemingen, met kleur en vorm van de zeldzaamste soort erin (zoals nu bij een stip met meerdere soorten). Nauwkeurigheidscirkels alleen tonen voor losse stippen, anders wordt het een vlek.
  2. **Zelf groeperen op schermafstand:** bij elke zoom opnieuw stippen binnen ±24 px samenvoegen (uitbreiding van `groupByPosition`). Geen extra pakket, maar zoom- en tikgedrag zelf bouwen.
  3. **Cluster als lijst:** tikken op een cluster opent meteen het popup-venster met alle waarnemingen erin (dat venster is al een lijst met knoppen naar de lijst), met een knop "Inzoomen". Op een telefoon is dat sneller dan drie keer inzoomen. Te combineren met 1 (`clusterclick` zelf afhandelen).
  Voorstel: 1 met het popup-gedrag van 3 bij een klein cluster (bv. ≤ 5 waarnemingen of hoog ingezoomd), anders inzoomen. Speelt het meest bij lang op één plek staan (vogelhut); testen met een echte wandeling uit de testset.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen staan niet in git: `.dev.vars` per computer zelf aanmaken (zie README), en `.testers.json` meekopiëren als je testers met het script wilt beheren.
