# Stand van zaken

Werklog om tussen computers te kunnen schakelen. Werk dit bij aan het eind van elke werksessie, vóór het pushen. Oudere bevindingen uit de veldtests staan in `docs/veldtests.md`, de beoordeling van de mijlpaal in `docs/mijlpaal-mvp.md`; wat er per PR gebeurde, staat in de PR's op GitHub.

## Waar ik ben (21 okt)

- Bouwstappen 1–7 uit `CLAUDE.md` klaar en gemerged (t/m PR #78). In productie op `fluistervink.stephanmullernl.workers.dev`, met een eerste tester (sinds 16 okt); Tim (alter ego van de eigenaar) is gewist.
- **Mijlpaal MVP gehaald** (12 okt, `docs/mijlpaal-mvp.md`): 88% van de waarnemingen zonder correctie goed, correcties met de stem 9 van de 10 keer.
- **Spraakherkenning: `gpt-4o-transcribe` blijft** (testset 12 okt: 9/12, tegen `gpt-4o-mini-transcribe` 8/12 en `whisper-1` 7/12).
- **Export gebundeld** (PR #90, 13 okt): na het nalopen zet je een wandeling "klaar voor waarneming.nl"; op het scherm Wandelingen gaan alle klaarstaande wandelingen in één CSV. Bestaande wandelingen hebben nog geen "klaar": de nog niet geëxporteerde één keer klaarzetten.
- Uitgaven: bij OpenAI en Anthropic vooraf betaald tegoed met auto-reload uit; dat is de harde grens. Stand 11 okt: $0,36 die maand bij Anthropic, 97% uit de cache, ruwweg een tiende cent per uitspraak.

## Volgende stappen

0. **Native laag** (`docs/plan-capacitor.md`): fase 0 (#94, microfoon van de telefoon zonder echo-onderdrukking; in de auto ook goed, 24 okt) en fase 1 (#95, Android-app met trilpatronen) gemerged op 14 okt. Getest op de Fairphone 5 (Android 15): alle patronen komen door, ook op stil. Eerste wandeling met de app (14 okt, 19 min, 17 uitspraken): ging goed. Microfoon zonder echo-onderdrukking (`mic_opened`), antwoord in 2–7 s. Merlin openen stopt de opname (verwacht, zo laten); vliegtuigmodus midden in een opname: netjes opnieuw geprobeerd. Missers: "ekster" werd "Extra" (STT, ekster ontbreekt), en "één huismus ter plaatse, nee, maak er twee van, een mannetje en een vrouwtje" maakte van de huismus van 11:36 een mannetje en voegde een vrouwtje toe met activiteit roepend (model, Haiku). Nagespeeld met de testset (juiste uitkomst met de hand ingevuld): de huidige prompt deed het 20 van de 21 keer goed, dus een uitschieter. Een extra regel in de prompt maakte geen meetbaar verschil en is niet toegevoegd. Wel de wandeling nalopen, dan komt de uitspraak met het goede antwoord in de testset. Fase 2 (foreground service, PR #96, gemerged 14 okt): **proef geslaagd** (proefwandeling 14 okt 13:43): melding start meteen, 3 van de 7 uitspraken op de achtergrond verwerkt in 6–7 s, tril komt door met het scherm op slot, geen `vibrate_blocked`. Een native wachtrij is dus niet nodig. Scherm op slot tijdens een opname stopt die (zo laten; microfoon in de service niet nu, besloten 14 okt). `#uitleg` en `#privacy` bijgewerkt in PR #99; daarmee is fase 2 klaar. Volgende: fase 3 is een aparte beslissing (opnemen met het scherm uit). Export in de app (15 okt): #98 Opslaan als-venster, maar de CSV was op waarneming.nl uitgegrijsd (uploadveld accepteert alleen het type `text/csv`, Android geeft een .csv buiten Chrome-downloads een ander type); #101/#103 hielpen niet. **Opgelost met #104: de app exporteert xlsx** (in Downloads, zonder venster), upload en import werken (bevestigd 24 okt). Verder 15 okt: versienummer van de app uit git (#100, te zien bij Instellingen, log `native_version`; huidige APK 0.318), terugknop gaat een pagina terug en op het hoofdscherm naar de achtergrond (#102), kaart met knop "Kaart opnieuw laden" na een zwart vlak (#102). 16–21 okt: zes dagen weg met de app (0.318), 6 wandelingen, 115 uitspraken, geen problemen met de app zelf. Feedback opgehaald 21 okt: drie punten, alle drie in een PR (#106 net verstuurde feedback leek overschreven, want hij klapte meteen in; #107 lange wandelnaam overlapte het label; #108 een verbeterde notitie werd aangevuld in plaats van vervangen, door een regel in de prompt). Testset (eigenaar, 258 uitspraken): opgeslagen antwoorden 87% goed, opnieuw met de huidige prompt 86%, met #108 84% (verschillen zijn ruis). De wandeling van 21 okt staat klaar maar is nog niet nagelopen. **Nieuwe tester**: 4 korte wandelingen (16–17 okt), 4 uitspraken, alles goed herkend. Daarna (21 okt): #109 losse feedback per apparaat (de Android-app en de PWA in Chrome overschreven elkaars losse feedback op de proxy; zo ging de wens hieronder verloren; het punt van 16 okt kwam op 21 okt terug van de PWA; op de proxy staat nu per apparaat een `losse-feedback-<id>` naast de oude `losse-feedback`) en #110 gebruik per tester op Developer (wandelingen, uitspraken, feedback, laatste actie; alleen wat gedeeld is). Developer liep vast bij dubbele feedback (`each_key_duplicate`, knop "Verwerkte tonen" deed niets); nu ontdubbeld in proxy en app. Twee oude testcodes afgesloten, gegevens van `stephan` en `Tim` gewist (Tims ene wandeling van 11 okt is daarmee ook uit de testset). Alle feedback tot 21 okt is verwerkt. **Fase 4 (Google Play, 24 okt):** PR #105 (workflow die bij een tag `v0.*` een ondertekende AAB bouwt; handleiding `docs/google-play.md`) is klaar om te mergen. Play Console-account (persoonlijk) aangemaakt, wacht op verificatie door Google. Daarna: app aanmaken, upload-key en de vier secrets, tag `v0.1`, AAB uploaden naar de interne test, testers toevoegen; eigen debug-APK eerst verwijderen.
1. Een paar echte betatesters uitnodigen (de eigenaar regelt ze) en nog een wandeling van jezelf met de huidige versie; daarna Capacitor (trillen en achtergrond eerst, wake word later). Zie de roadmap naar v1.0 hieronder.
2. Bij elke nieuwe gedeelde wandeling `npm run feedback -- pull` en `npm run testset` draaien, eventueel ook met `--model claude-sonnet-5-5`.
3. Prompt verbeteren met wat de testset laat zien ("tortelduif"), telkens nagaan met de testset.
   - **Waar correcties vandaan komen** (analyse 24 okt, 15 nagelopen wandelingen, 229 waarnemingen van het model): 81% nooit aangeraakt; de meeste stemcorrecties zijn aanvullingen ("nog drie erbij"). Echte fouten: ~10 soorten verkeerd verstaan door de spraakherkenning (vaak korte uitspraken met één soort, verward met een andere echte vogelnaam: kraai/gaai, smient/vink, kuifmees/koolmees), 1–2 keer het model, 4 keer een detail (geslacht, leeftijd). Het model is dus niet het knelpunt.
   - **STT-prompt blijft zoals hij is** (proef 24 okt, 153 opnames, elke variant drie keer): korte lijst, eigen soorten vooraan (eerlijk getest: lijst uit de wandelingen tot 16 okt, gemeten vanaf 17 okt), andere voorbeeldzinnen en lijst achteraan zitten allemaal binnen de ruis (dezelfde prompt schommelt ±3 soorten per run; eigen lijst +1 op 114). Zonder soortenlijst duidelijk slechter (88,6% tegen 94%). De hardnekkige fouten zitten in de opname zelf, deels mogelijk een afgekapt begin (microfoon gaat pas aan na het drukken); eigenaar vindt het goed zo.
4. Kosten per wandeling: staan op Developer zodra PR #133 gemerged is (zie Kostenoverzicht onder Ideeën voor later); niet meer apart in het testset-script.

## Roadmap naar v1.0 (13 okt)

Werkdefinitie van v1.0: een vogelaar die je niet persoonlijk begeleidt, kan de app installeren, een hele wandeling gebruiken zonder naar het scherm te kijken, en thuis zonder gedoe naar waarneming.nl exporteren.

**Besloten (13 okt): v1.0 voorlopig voor een besloten kring**, met toegangscodes zoals nu. Openbaar in de Play Store zou betekenen: bepalen wie de API-kosten betaalt (tegoed per gebruiker, eigen sleutel, limiet) en misbruik afvangen; dat komt pas later aan de orde. Uitgewerkt in `docs/plan-laagdrempelig.md` (28 okt, goedgekeurd): de eigenaar betaalt, plafond en daglimiet in de consoles van OpenAI en Anthropic, ook de PWA zonder code. **Gebouwd in PR #142** (aanmelden zonder code met Play Integrity/Turnstile, code optioneel); na het mergen nog instellen (geheimen, Turnstile-widget, Play Integrity, nieuwe app-versie), zie het plan onder Instellen. **v0.1-release mislukte (28 okt)**: Dependabot zette Gradle op 9.8.2 (#115), dat werkt niet met AGP 8.13; PR #141 zet hem terug op 8.14.3, daarna opnieuw taggen.

1. **Veldgebruik afmaken met de native laag (Capacitor), de kern van v1.0:**
   - Trillen op de achtergrond en met het scherm uit (grootste ergernis van de eerste wandeling).
   - Opnemen met het scherm uit via een foreground service; microfoon loslaten als Merlin hem wil.
   - Verspreiden via de Play Store (eerst interne test).
   - Te overwegen: volumeknop of Bluetooth-afstandsbediening als push-to-talk (handschoenen, telefoon in de zak).
   - Wake word **buiten v1.0**: de knop bevalt, en een wake word brengt eigen valse meldingen mee.
2. **Herkenning breder bewijzen:** de 88% rust op drie wandelingen van één spreker, in één omgeving, in oktober.
   - Meer sprekers: twee à drie echte betatesters met een echte wandeling. Tim is een alter ego van de eigenaar, dus alle gegevens tot nu toe komen van één spreker.
   - Voorjaarsronde (april/mei): veel meer soorten, zang, broedgedrag, paartjes. Reden om v1.0 niet vóór het voorjaar te noemen.
   - Open punten: korte spookopnames (#92); nocmig: niet nu. "Pijl" en "vaaltje" werken al (bijnamen, proef 11 okt).
   - Kosten per wandeling: op Developer (PR #133).
3. **Klaar voor vreemden:**
   - Twee omgevingen (stabiel en beta, zie Ideeën voor later).
   - Welkom en uitleg voor wie geen uitnodiging kreeg: toestemming voor microfoon en GPS, eerste wandeling stap voor stap.
4. **Thuis meer waarde dan alleen exporteren** (zolang de API van waarneming.nl wacht):
   - Kaart clusteren (voorstel onder Ideeën voor later).
   - Snellere review: alleen de onzekere langslopen, "alles klopt" met één tik.
5. **Bewust niet in v1.0:** API van waarneming.nl (v1.0 levert juist de gebruikers op die de aanvraag sterker maken), GPS-track, accounts, BirdNET, wake word.

Volgorde: (a) nu de kleine open punten, betatesters uitnodigen en een wandeling; (b) Capacitor: trillen, foreground service, eventueel volumeknop; (c) twee omgevingen, dan twee à drie testers erbij; (d) voorjaar: veldtest met veel soorten, prompt bijwerken, daarna v1.0 in de Play Store.

## Twee omgevingen (24 okt)

PR #112: beta blijft op workers.dev (branch `main`), stabiel op `fluistervink.nl` (branch `stable`, `npm run release`). KV en geheimen gedeeld, veld `channel` in gedeelde wandelingen. Eén Play-app: beta-AAB naar de interne test, stabiele naar een gesloten test. Gemerged 24 okt. **Live op 24 okt:** `fluistervink.nl` bij Cloudflare (Free; parkeerrecords van TransIP weg, geen mail: SPF `-all`, DMARC `p=reject`), branch `stable` aangemaakt, Workers Builds-project `fluistervink-stable` (build `npm run build:stable`, branch `stable`), vier geheimen gezet. `/api/ping` met de eigenaarscode geeft 200. Proefopname op de telefoon via `https://fluistervink.nl/#code=…` geslaagd. "Always Use HTTPS" staat aan; `www.fluistervink.nl` stuurt door naar `fluistervink.nl` (AAAA `100::` proxied plus redirect-regel, 301). Debug-APK `apk/fluistervink-0.348-beta.apk`.

## Kwaliteitsronde (24 okt)

PR #113: `docs/kwaliteitsronde.md` (direct na een release naar stable een ronde op de beta, met logboek), `npm run release` toont de laatste ronde en vraagt eerst, Dependabot (`.github/dependabot.yml`; meldingen en beveiligingsupdates in de repo aangezet), `npm audit --omit=dev` in de check. Eerste ronde gedaan op 24 okt (logboek in `docs/kwaliteitsronde.md`): PR's #121 (snelheidslimiet proxy, Content-Type), #122 (validatie aantallen), #123 (contrast, `#privacy`). Dependabot opende meteen #118 (@types/node), #119 (TypeScript 7, faalt) en #120 (happy-dom, het hoge lek). Open voorstel: Inspreken-knop lager, in de duimzone (andere indeling, eerst overleggen).

## Open punten

- **App hing op het laadscherm na een deploy** (14 okt): de service worker had een oude `index.html` naast nieuwe JavaScript in zijn cache (deploy tijdens het openen). Op de telefoon hersteld via de WebView-devtools (adb, `webview_devtools_remote_<pid>`); PR #97 herstelt het voortaan zelf (`public/herstel.js`, log `cache_recovered`). Workers Builds heeft nu build watch paths: `*.md` en `docs/*` deployen niet meer.

- **Nieuwe versie tijdens een wandeling** (#65, afgehandeld 24 okt): de app zoekt alleen bij het opstarten naar een nieuwe versie en herlaadt niet meer midden in het gebruik. Na een volledige herstart tijdens een wandeling krijgt hij wel de nieuwe versie (Android activeert de wachtende service worker als de app dicht was); onschuldig, zo gelaten.
- **Korte spookopnames** (PR #92, 13 okt): grens van `isAccidental` naar 3,5 s en < 0,3 woord/s, zodat ook de Bosuil (3,9 s) onzeker wordt. Bewust klein gehouden; geen verdere moeite nodig volgens de eigenaar.
- **STT gaf één keer zelf antwoord** in plaats van te transcriberen ("Sorry, ik kan niet voldoen aan het verzoek …", 11 okt) en liet daarbij het woord "feedback" weg. Onschuldig, maar in de gaten houden.
- Cloudflare-previews: vermoedelijk onthoudt Cloudflare het deploy-commando per branch vanaf de eerste build. Bij problemen: nieuwe branch maken.
- Een branch-regel op `main` met verplichte check kan niet: GitHub biedt dat niet voor privérepo's zonder Pro. De check draait wel bij elke PR.
- **`gpt-4o-transcribe` "Deprecated"** (gezien op 24 okt op de modelpagina van OpenAI): opvolger uitzoeken en met de testset vergelijken voordat het model verdwijnt.

## Ideeën voor later

Nog niet gepland; eerst overleggen.

- **Back-up / nieuwe telefoon** (24 okt op de lange baan: twijfel of mensen het gebruiken; eerst invoeren makkelijker maken): alles staat lokaal. Voorstel was een kaart "Back-up" in Instellingen die `exportAllJson` (met opnames) en `importJson` hergebruikt, met de datum van de laatste back-up. Automatisch via de proxy of naar Drive via het deelmenu (native plugin) pas daarna.
- **Inzenden via de API van waarneming.nl** — op de lange baan (13 okt): toegang is niet vanzelfsprekend; pas aanvragen als blijkt dat er interesse in de app is (meer gebruikers = sterkere aanvraag). Tot die tijd de gebundelde CSV-export. (Uitgezocht 13 okt; de officiële documentatie op `waarneming.nl/api/docs/*.md` gaf ons een 403, dus gecontroleerd in de TypeScript-client [observation-js](https://github.com/robbeverhelst/observation-js); nog na te lopen in de documentatie, ingelogd):
  - De API kan wel waarnemingen invoeren (niet via het importformulier). `POST /api/v1/observations/create/` ("one-way sync") neemt een lijst waarnemingen en geeft per waarneming de URL of de fouten; een fout houdt de rest niet tegen; `external_id` voorkomt dubbel invoeren (bestaande wordt bijgewerkt). `create-single/` is voor één waarneming met foto's/geluid.
  - Velden passen op wat we bewaren: `species` (ID), `date`, `time`, `point` (GeoJSON of WKT), `accuracy`, `number`, `sex`, `activity`, `life_stage`, `method`, `counting_method`, `is_certain`, `notes`, `uuid`.
  - OAuth: `/api/v1/oauth2/authorize/` en `/api/v1/oauth2/token/` (authorization code of password grant, met client-ID en secret). Testomgeving: `waarneming-test.nl`.
  - Eerst een client-ID aanvragen via het contactformulier (concept in de sessie van 13 okt: app, nalopen vóór inzenden, vaste soortenlijst, 88% goed; vragen: inlogmethode, client secret, testaccount op waarneming-test.nl, `create/` met `external_id` en welke scope, redirect-URL). Daarna: account koppelen bij Instellingen, route `/api/waarneming` in de proxy (CORS, secret), knop "Inzenden" voor de klaarstaande wandelingen, ID/link van waarneming.nl bewaren, `#privacy` en `#uitleg` bijwerken.
- **Soortenstatistieken over alle gebruikers:** tellen per soort-ID wat het model koos, wat met de hand gecorrigeerd werd en wat het niet kon plaatsen, om de soortenlijst, bijnamen en STT-prompt bij te stellen. Kan in de proxy (Analytics Engine of D1); alleen geaggregeerd, en op `#privacy` vermelden. Pas relevant bij meer gebruikers; tot die tijd geeft de testset hetzelfde beeld.
- Foto koppelen aan een waarneming via tijd en locatie.

## Android-app

- Bouwen vraagt Java 21 (Temurin uit `~/Library/Java/JavaVirtualMachines/`; Homebrew bouwt het op de Intel-Mac uit de broncode) en `JAVA_HOME` naar de Java van Android Studio, zie README.
- Installeren gaat draadloos (adb, draadloze foutopsporing): de USB-poort ziet de Fairphone niet. De verbinding valt weg als de telefoon op slot gaat of van wifi wisselt; dan opnieuw aanzetten. De poort vindt `adb mdns services`; koppelen (`adb pair`) blijft bewaard.
- Trillen als "communicatieverzoek": als "melding" hield Android het op stil tegen (`ignored_for_ringer_mode`). Nagaan met `adb shell dumpsys vibrator_manager`.
- De app heeft een eigen database (los van de PWA in Chrome): eenmalig overzetten met de JSON-export en -import.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen staan niet in git: `.dev.vars` per computer zelf aanmaken (zie README), en `.testers.json` meekopiëren als je testers met het script wilt beheren.
