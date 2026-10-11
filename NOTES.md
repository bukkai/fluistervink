# Stand van zaken

Werklog om tussen computers te kunnen schakelen. Werk dit bij aan het eind van elke werksessie, vóór het pushen.

## Waar ik ben

- Stap 1 (projectopzet) en stap 2 (proxy) gemerged (PR #2, #3, #4).
- Locatie gemerged (PR #6) en gedeployd: GPS warm tijdens de wandeling, positie (met nauwkeurigheid en meettijd) bij elke uitspraak en waarneming. Getest met nep-GPS: verse meting, stilstaan, trage meting, geen toegang.
- Stap 3 (interpretatie met tekstinvoer) gemerged (PR #5) en gedeployd: tijdens een wandeling typ je een uitspraak, Claude Haiku 5.5 zet hem om in tool calls (`add_observation`, `update_observation`, `delete_observation`, `undo`), de app valideert en voert ze uit. Lokaal getest met echte sleutels: 13 testuitspraken (toevoegen, correctie, "nog drie erbij", verwijderen, ongedaan maken, gepraat negeren) gingen allemaal goed, ±2 s per uitspraak. Prompt caching werkt (~6900 tokens uit de cache).

## Stap 5 (review), 10 okt

Opgesplitst in drie PR's, elk los te reviewen en mergen:

- **#14 Trilfeedback:** patronen in `src/lib/feedback.ts` (opgeslagen 1 kort; onzeker kort-lang; niet begrepen 2 kort; fout 3 kort; tikje bij start opname). Op de telefoon nalopen of ze te onderscheiden zijn.
- **#15 Bewerken en nalopen:** tik op een waarneming → formulier (soort via lijst met suggesties, aantal, gedrag, methode, kleed, geslacht, telmethode, opmerking, onzeker, verwijderen). "Alleen onzeker"-filter en knop "Klopt". ▶ en kaartlink bij elke waarneming (locatie-idee optie 1). Nieuw veld `editedAt`.
- **#16 Wandeling voortzetten:** knop bij de meest recente wandeling, als er geen andere loopt.

Alle drie gemerged (9–10 okt). Daarna **#18 Gebied van waarneming.nl** bij elke waarneming: openbaar adres `locations/geojson/?coordinates=lat,lon` (geen inloggen, wel via de proxy want geen CORS), ID en naam bewaard bij uitspraak en waarneming, ontbrekende gebieden worden bij het openen van een wandeling alsnog opgezocht. PDOK niet nodig. Bijnamen in het soortveld: besloten van niet (bijnamen zijn alleen voor de spraak).

## Stap 6 (CSV-export), 10 okt

**PR #19** (branch `csv-export`). Ingelogd op waarneming.nl gekeken: er is een eigen **bulkimport** (`/import/observations/`), veel beter dan eBird. Velden voor gedrag, methode, kleed, telmethode, geslacht, zekerheid, nauwkeurigheid, opmerking en `uuid` (tegen dubbel invoeren). Gedrag en methode gaan als tekst in de taal van de site: de app exporteert Engels, dus **site op Engels zetten bij het importeren**. Geen kolom voor het gebied; dat bepaalt waarneming.nl zelf. Details in `docs/waarneming-nl.md`.

Gemerged (10 okt). Nog doen: eerste echte import, zie hieronder.

## Volgende stap (11 okt, avond)

Gemerged t/m **#48**: #46 kaart ↔ lijst in de review, #47 opruimen (alles/lege aanvinken), #48 woordenlijst (alle codes in het formulier; afkortingen leeftijd/kleed, nocmig in de prompt; kleed en geslacht verplicht met `null`).

**Stap 7, testset — open:**
- **PR #49** JSON-export met opnames: gemerged.
- **PR #50** `npm run testset -- <export.json>`: haalt uitspraken opnieuw door het model (en met `--stt …` door een andere spraakherkenning) en scoort tegen de nagelopen waarnemingen. `--model origineel` = nulmeting zonder API. Exports en resultaten in `testset/` (gitignored); onbruikbare labels in `testset/uitsluiten.txt`. Uitleg bovenin `scripts/testset.mjs` en in de PR.
- Eerste run op de export van 10 okt (zonder opnames): destijds 41/44, nu 36/44, waarvan 5 ruis door oude labels (staan in `uitsluiten.txt`). Aandachtspunten prompt: "cirkelend ten westen van hier" ≠ overvliegend west; "klinkt als een winterkoning, even in Merlin checken" wordt een waarneming. Het model is niet bij elke run gelijk.
- **#50** (testset-script) en **#51** (prompt: plek ≠ vliegrichting, vermoeden = onzekere waarneming) gemerged.
- **PR #52** (gemerged) soortnaam bij elk soort-ID: model schrijft eerst `species_name`, dan `species_id`; hoort het ID niet bij de naam, dan geldt de naam (log: `species_id_fixed`, testset telt ze). Oorzaak: Boomklever (70) en Boomkruiper (71) werden verwisseld. Testset 37/38 (enige fout is ruis).
- STT met de macOS-stem: `gpt-4o-mini-transcribe` verstond "keep" als "geen"; `gpt-4o-transcribe` goed en sneller.

**Testers (11 okt, avond) — gemerged:**
- **#53** een eigen toegangscode per tester: geheim `ACCESS_CODES` (JSON, naam → code) naast `ACCESS_CODE` (= "eigenaar"). Proxy logt de tester per verzoek (Workers Logs); naam in Instellingen, JSON-export (`tester`) en dev notes ("Van: …"). Uitnodigingslink `https://fluistervink.stephanmullernl.workers.dev/#code=…`. Beheer: `npm run tester -- add/remove/list/push/url`; codes in `.testers.json` (niet in git, **alleen op de computer waar je het draait**: meekopiëren of in de wachtwoordmanager). Het script zet `ACCESS_CODES` in productie én in de Previews Base (previews erven geen geheimen).
- **#54** na de link naar het hoofdscherm met "Welkom, …" (of een melding als de code niet werkt); productie-adres standaard in het script.
- **#55** bijnaam "ekkie" → Ekster (voor de eerste tester).
- Eerste tester uitgenodigd. Nog niet gedaan: harde uitgavenlimieten in de consoles van OpenAI en Anthropic. GitHub-mails per Cloudflare-build: uitzetten in Cloudflare (Settings → Build, reacties op GitHub) of in GitHub Notifications, afhankelijk van de reden onderaan de mail.
- **#57** delen met de ontwikkelaar: gestopte wandelingen (en feedback, log) gaan automatisch per tester naar KV (`/api/feedback`), opnieuw na wijziging; opnames alleen als de tester dat aanzet. Ophalen: `npm run feedback -- pull` (→ `testset/feedback/<tester>.json`) en `npm run feedback -- notes`. "Dev note" heet nu "feedback" (oud voorvoegsel werkt nog).
- **#58** melding "Wandeling opgeslagen" in saliegroen.
- **Privacy (branch `privacy`):** pagina `#privacy` in het menu; delen pas na toestemming (vraag op het hoofdscherm, ook voor wie de app al had: tot die tijd deelt de app niets); Workers Logs zonder invocation logs (coördinaten van `/api/area` stonden in de URL); `npm run feedback -- wipe <tester>`. Na het mergen: eerste tester even laten weten dat de vraag komt.
- **#60** delen naar het Feedback-scherm, JSON-export/import naar scherm Developer (alleen eigenaar). **Hoe werkt het?** (branch `hoe-werkt-het`): pagina `#uitleg`.
- Nog open voor testers: feedback typen en verwijderen op het Feedback-scherm, uitgavenlimieten bij OpenAI en Anthropic (handmatig). Twee exemplaren tegelijk is al opgelost (`src/lib/instance.svelte.ts`).

Daarna:

1. **Derde wandeling**, daarna exporteren **met opnames** en `npm run testset` draaien: per run met `--stt gpt-4o-transcribe` en `gpt-4o-mini-transcribe` (en `whisper-1`), en eventueel `--model claude-sonnet-5-5`. Ook nagaan of de vertraging van #44 weg is.
2. Prompt verbeteren met wat de testset laat zien (punten hierboven, "tortelduif"), telkens nagaan met de testset.
3. F. Vitest. Mijlpaal na 3–4 wandelingen.

### Eerder (10 okt)


Eerste wandeling gedaan (10 okt), bevindingen hieronder bij "Eerste echte wandeling". Roadmap A (bevindingen verwerken) loopt:

- Gemerged: **#25** prompt (toevoegen + corrigeren in één zin, windrichting, dood, schatting, geslacht splitsen, KPV, `add_dev_note`), **#26** twijfelreden niet in de CSV-opmerking.
- Open (10 okt):
  - **#28** soortenlijst: "Steenduif" (72499) was een Zuid-Amerikaanse grondduif → Stadsduif (80199); Parkgans (soepgans), Parkeend (soepeend), Chinese Knobbelgans, Zwaangans erbij. Geen kip. Bestaande "Steenduif"-waarnemingen met de hand aanpassen.
  - **#29** (bovenop #28): formulier gebruikt alle ±1080 soorten (dwaalgasten als Dwergaalscholver, Notenkraker; geen ondersoorten). Model houdt de korte lijst en zet "Gezegd: …" in de twijfelreden. Besloten: niet alle soorten in de prompt (meer valse knallers; knallers check je toch met de hand).
  - **#30** veldgedrag: tikje bij loslaten (opgenomen), opname stoppen bij wisselen van app, `vibrate_blocked` in het log. Op de telefoon testen.
  - **#31** lijst opruimen: knop "Weg" bij onzeker, prullenbak (aparte tabel `deletedObservations`, db-versie 3) met terugzetten, ▶ uit de lijst, aantal soorten.
  - **#32** terugknop sluit het formulier (pushState/popstate). Op de telefoon testen.
  - **#34** naam van de wandeling: bij start het waarneming.nl-gebied van de startpositie, bij stoppen het gebied met de meeste waarnemingen, met de hand aan te passen. Vergeleken met OpenStreetMap (natuurreservaat Mariëndaal, zelfde uitkomst), maar Overpass was onbetrouwbaar; eventueel later als verfijning. Naam bij het starten nog op de telefoon testen.
- **#35** app hernoemd naar **Fluistervink** (woordgrap op luistervink, ook het toekomstige wake word). Ook intern (database, toegangscode-sleutel, Worker): lege database en nieuwe URL, oude gegevens alleen nog in de JSON-export. Na het mergen: repo hernoemen, nieuwe Worker bij Cloudflare via "Import a repository" met de drie geheimen, oude Worker weg, app opnieuw installeren, map en Claude-geheugen verplaatsen.
- **D. Flow en indeling** (11 okt, voor een demo op 13 okt), drie gestapelde PR's, mergen in volgorde en de basis telkens eerst naar `main` zetten:
  - **#37** rustig hoofdscherm met kopbalk en menu; vorige wandelingen, dev notes en instellingen als eigen schermen (`#wandelingen`, `#devnotes`, `#instellingen`).
  - **#38** reviewscherm: na "Stop wandeling" meteen naar de wandeling; tegels duur/soorten/waarnemingen (+ onzeker), kaart, lijst, "Klaar met nalopen?" met exportknop.
  - **#39** opruimen: label geëxporteerd per wandeling, wandelingen aanvinken en verwijderen (ook "alle geëxporteerde"), verwijderen vanaf een wandeling. Echt verwijderen, geen prullenbak.
  - Nog niet: kaart en lijst aan elkaar koppelen (stip ↔ waarneming).
- Uit A: de CSV-import is getest (11 okt), werkt.

Stap 1–6 gemerged (t/m PR #19, 10 okt). Daarvoor: **testronde in het veld** (in productie), één echte wandeling, korte versie is genoeg.

1. **Import:** CSV exporteren en importeren via de bulkimport van waarneming.nl (site op Engels). Letten op verzamelsoorten, gedrag en methode, en of `uuid` dubbel invoeren voorkomt. Fouten of schermafbeelding plus CSV aan Claude geven.
2. **Telefoon:** trilpatronen te onderscheiden? Begin van de zin afgekapt? Snelheid per uitspraak? GPS-nauwkeurigheid (buiten vaak 3–10 m)?
3. **Herkenning:** eigen zinnen en jargon gebruiken; opvallende fouten noteren (dev notes).
4. Na afloop: JSON-export (Instellingen) en dev notes aan Claude geven voor analyse.

Op een nieuwe computer: `.dev.vars` aanmaken (zie README), en `.testers.json` meekopiëren als je testers wilt beheren.

### Roadmap na de testronde

- **A. Bevindingen verwerken:** fouten uit de import en de wandeling, aanpassingen aan prompt, bijnamen en Whisper-prompt.
- **B. Stap 7, testset:** export van audio, transcript, LLM-uitvoer en gecorrigeerde waarneming; daarna een script dat de testset opnieuw door STT en model haalt en scoort (prompts, modellen, Web Speech API vergelijken).
- **C. Kleine verbeteringen:** eigen notitie naast de opmerking (PR #20, gemerged) en vinkje "Exporteren" per waarneming (PR #21). Status "geëxporteerd" per wandeling zat al in PR #19.
- **D. Flow en indeling** (`docs/ideeen-flow.md`): menu met instellingen en vorige wandelingen (opruimen), locatienaam bij start, reviewscherm na "stop wandeling".
- **E. Kaart in de review:** alleen-lezen kaart (Leaflet + OSM) in PR #22 (branch `kaart`), bewust ná de testronde mergen. Stip verslepen kan later; een GPS-track is niet gewenst.
- **F. Geautomatiseerde tests** (Vitest, later Playwright en GitHub Actions).
- **Mijlpaal:** na 3–4 wandelingen beoordelen of de MVP geslaagd is; pas dan Capacitor, wake word en achtergrondgebruik.

## Tweede wandeling (11 okt, Arnhem, versie 97084fc)

Export `fluistervink-2026-10-11.json`. 18:06–18:19, kort: telefoon ging uit (accu leeg) midden in een dev note. 10 uitspraken: 7 waarnemingen, 3 dev notes. Wandeling staat nog op actief.

**Herkenning en interpretatie: goed.** Spraakherkenning foutloos, spraakherkenning ±1 s, model 2–4,5 s. Twee dubbele waarnemingen (zin herhaald omdat de eerste kwijt leek) met de hand weggehaald. "Tortelduif" → Turkse Tortel onzeker, met de hand bevestigd.

**Traag (dev note: "bijzonder langzaam", interface na verversen even leeg, opnames die later terugkomen).** Wachttijd tussen einde opname en start verwerking: 2 min (ekster), 2 min (huismus), 1 min 48 (kauwen), 1 min (merel), en bij de merel nog eens 59 s *ín* de verwerking terwijl de verzoeken samen maar 3,7 s duurden. Na het herstarten van de telefoon (18:18) weer direct (8 s).
- Niet het netwerk: elk verzoek dat liep was snel (spraak ±1 s), geen time-outs of `attempt_failed`. Eén `offline` van 2 s en één `area_error`. Wifi is dus vermoedelijk niet de oorzaak.
- Wel IndexedDB: de tijd zit in de stappen zonder netwerk. Bij de start van 18:08:42 deed de wachtrij ruim een minuut niets (het `requeued` kwam pas na de volgende start). Past bij "interface leeg na verversen".
- Vermoedelijke oorzaak: **twee exemplaren van de app tegelijk.** Om 18:06:22–27 werd de app geopend in een gewoon Chrome-tabblad (`standalone: false`, vier keer herladen door de update), om 18:06:49 in de geïnstalleerde app. Het tabblad bleef op de achtergrond open. Een bevroren achtergrondtabblad kan een IndexedDB-transactie vasthouden, en dan wacht het andere exemplaar. Beide exemplaren draaien ook een eigen wachtrij, en bij het opstarten zet de ene de uitspraken van de andere terug op "wachtend". De herstart sloot het tabblad, daarna was alles snel. Alternatief: telefoon met bijna lege accu in energiebesparing (minder waarschijnlijk, de herstart veranderde de accu niet).
- Kan niet hard bewezen worden: de log ziet niet welk exemplaar wat doet en meet geen tijden van IndexedDB.

**"Denkt dat de app op de achtergrond is":** de log heeft echte `hidden`-momenten (18:07:03–18:07:35 meteen na een opname, 18:11:44–18:12:06). Nagaan: scherm uit? Of een melding over de bijna lege accu?

**Goed:** de laatste dev note bleef bewaard toen de telefoon uitging (`recording_stopped_hidden`), en werd nog verwerkt.

**Voorstel PR:** (1) Web Locks (`navigator.locks`) om de wachtrij, zodat maar één exemplaar verwerkt en een tweede niet de uitspraken van het eerste terugzet. (2) Melding "Fluistervink is al open in een ander venster". (3) Meten: moment van opslaan, tijd per stap (database, spraak, model) en een id per exemplaar in elke gebeurtenis.

## Eerste echte wandeling (10 okt, Arnhem, versie 6e80882)

Export `thijsse-2026-10-10.json` geanalyseerd. 14:39–16:12, 55 uitspraken: 33 waarnemingen/correcties, 19 dev notes, 3 genegeerd. 30 waarnemingen over.

**Wat goed ging**
- Snelheid: na het loslaten ±1 s spraakherkenning + 2–4 s model (één keer 8 s). Geen wachtrij. De 1–2 minuten van 9 okt zijn weg.
- Spraakherkenning vrijwel foutloos, ook "grobo", "blako", "KBV'tje". Uitzonderingen: "kpv'tje" (KBV'tje) → Koperwiek onzeker; "roofbouwt" (ruigpoot).
- Correcties werkten: "nee, twee", "nee correctie drie zwarte kraaien", "nog een paartje erbij", "die boomkruiper mag weg", "die laatste is een KBV'tje", "die buizerd een hele tijd terug was een ruigpoot" (ref 7).
- Vliegtuigmodus: 3 uitspraken netjes bewaard, verwerkt na "Opnieuw". App afsluiten en telefoon herstarten: alles bewaard, wandeling liep door.
- GPS buiten meestal 3–20 m, een paar verse metingen 55–75 m. Gebied van waarneming.nl klopt (Lombok, Mariëndaal, Klingelbeek).
- Knop indrukken bevalt; wake word misschien niet eens nodig.

**Fouten en verklaringen**
- *Niet trillen:* `navigator.vibrate` doet niets als de pagina verborgen is (scherm uit, andere app). 58× hidden in het log; de eerste uitspraken werden verwerkt terwijl de app op de achtergrond stond. Op de voorgrond wel testen. Echte oplossing pas met Capacitor; tot die tijd misschien trillen bij het loslaten van de knop (dan is de app zeker zichtbaar) als "opgenomen".
- *Buizerd → "twee" ruigpootbuizerds:* geen fout. De eerdere uitspraak was "Buizerd overvliegend... Nee, twee." → 2 buizerds; de update veranderde alleen de soort.
- *Toevoegen + verwijderen in één zin:* "Buizerd hoog boven de velden richting west. En die eerdere roofbouwt buizerds, die mogen er wel uit" → alleen verwijderd, de nieuwe buizerd ontbrak. Prompt: elke genoemde nieuwe vogel is een add, ook naast een correctie. Ook: "richting west" → overvliegend west (14), "cirkelend" niet als ter plaatse, "ten westen van hier" niet als notitie.
- *Vijf + nog twee houtduiven* in één zin → 7, onzeker. Prima, maar zonder onzeker.
- *Wilde eenden:* "2 vrouwtjes, 3 mannetjes" als opmerking i.p.v. gesplitst per geslacht (op 9 okt wél gesplitst). Na "nog een paartje" klopt de opmerking niet meer. Keuze maken: splitsen.
- *Gedomesticeerde bankivahoen:* staat niet in de soortenlijst → Vogel onbekend, onzeker. Exoten/gedomesticeerde vormen toevoegen? (Kip = verwilderd/gedomesticeerd op waarneming.nl.)
- *App-opmerkingen zonder "dev note"* (schatting bij grote groepen; geen statistiek in de app) → genegeerd en daardoor niet in de dev notes. Vangnet `add_dev_note` voor het model (stond al in het plan).
- *Microfoon en andere apps:* opnemen en dan naar Merlin/Collins schakelen → Thijsse houdt de microfoon, maar neemt niets op; de knop blijft "aan". Andersom (Merlin aan, naar Thijsse) werkt wel. Klein: opname stoppen bij `visibilitychange` → hidden.
- 14× `app_start` tijdens de wandeling (Android sluit de PWA op de achtergrond, terugknop sluit de app). Niets kwijt, maar wel opvallend.

**Wensen uit de dev notes**
1. Terugknop sluit het formulier i.p.v. de app (history-state).
2. Activiteit "vondst (dood)" (17) toestaan, plus "dood", "dode" in de prompt.
3. "Vijfhonderd schatting" / "schatting vijfhonderd" → telmethode 6 (prompt: woord "schatting").
4. Onzekere waarneming snel weg kunnen doen in de lijst (naast "Klopt"), en verwijderde waarnemingen in een apart bakje bij de review (zachte verwijdering; de gegevens staan nu alleen nog in `changes` van de uitspraak).
5. ▶-knop in de lijst weg (alleen voor ontwikkeling; verplaatsen naar het formulier of een dev-weergave).
6. Aantal soorten van de wandeling tonen. Verder geen statistiek/lijsten (bewust: dat is voor waarneming.nl).
7. Locatie(naam) van de wandeling, aan het eind aan te passen (sluit aan bij `docs/ideeen-flow.md`).
8. Later: foto koppelen aan een waarneming via tijd en locatie; vinkje "afgeschermd" (of aan waarneming.nl overlaten).
9. Bijnamen: "kpv" → KBV (Whisper-prompt of bijnamenlijst).

CSV-import op waarneming.nl getest op 11 okt: werkt.

## Bevindingen eerste test op de telefoon (9 okt)

Typen werkt, ook met de ingebouwde spraakinvoer van Android (die is matig). Besloten: dev notes eerst, daarna 1, 2 en 4. Dev notes worden los gelezen en door de eigenaar zelf doorgegeven (niet automatisch naar `NOTES.md`). Kaart: voorlopig alleen een link.

1. **Alles terug kunnen zien.** Er gaat niets verloren: sessies, uitspraken en waarnemingen staan in IndexedDB, ook na verversen en na "stop wandeling". Maar de interface laat het niet zien:
   - Tijdens de wandeling toont de lijst alleen verwerkte waarnemingen; uitspraken die nog in de wachtrij staan zitten weggeklapt onder "Uitspraken". Na verversen lijkt de invoer daardoor weg. → Uitspraken standaard zichtbaar, met status (in wachtrij / bezig / verwerkt / fout) en de waarnemingen eronder.
   - Eerdere wandelingen zijn alleen een regel met datum en duur. → Wandeling kunnen openen (alleen-lezen is genoeg om te beginnen). Dit is het begin van stap 5 (review), naar voren gehaald.
   - Ruwe data-export (JSON van alle tabellen) als vangnet tijdens de ontwikkeling.
2. **Trage verwerking (1–2 min per uitspraak; lokaal ±2 s).** Eigenaar test op 10 okt of ook de eerste uitspraak traag is, of pas als er meer in de wachtrij staat. Uitzoeken waar de tijd zit: wachten in de wachtrij, de proxy of het model. Bevindingen: `fetch` heeft geen time-out, dus één hangend verzoek houdt de hele wachtrij op. → Duur per uitspraak vastleggen (start/eind verwerking) en tonen; time-out op API-verzoeken (bv. 30 s) → status `failed` met "Opnieuw".
3. **Dev notes.** Een uitspraak die begint met "dev note" (of "def note", "devnoot": spraakherkenning) wordt geen waarneming maar een bevinding. Voorstel:
   - Herkenning in de app op het voorvoegsel, vóór het model (snel, gratis, betrouwbaar); als vangnet een tool `add_dev_note` voor het model.
   - Opslaan als uitspraak met `kind: 'dev_note'`, met tijd en locatie zoals elke uitspraak, zodat de context (welke uitspraken en waarnemingen ervoor kwamen) erbij blijft.
   - Zichtbaar in de wandeling en verzameld in een lijst, met export als Markdown om in een Claude-sessie te plakken / in `NOTES.md` te verwerken.
4. **Locatie op een kaart.** Nauwkeurigheid alleen is niet te controleren. Kaartweergave staat in `CLAUDE.md` buiten de MVP; dit is het overleg erover. Voorstel in twee stappen:
   - Nu: de positie (bij de GPS-regel en bij elke waarneming) tikbaar maken → opent Google Maps/OpenStreetMap op die coördinaten. Geen extra code of afhankelijkheden.
   - Later, bij de review: een kleine kaart (Leaflet + OpenStreetMap) met de waarnemingen van een wandeling.

## Testronde op de bank (9 okt, desktop-Chrome, versie 16cfad9)

22 uitspraken in 3 wandelingen (export geanalyseerd; 12 daarvan van vóór de metingen).

- **Snelheid:** 1,9–4,2 s per uitspraak, vrijwel alles bij Anthropic (proxy ±0,1 s), geen wachtrij, app op de voorgrond. De 1–2 minuten van de telefoon zijn op desktop dus niet te zien; telefoontest nodig.
- **Locatie raakt kwijt (desktop):** één positie bij de start (±35 m, wifi), daarna geen updates meer; de positie veroudert (9 s … 109 s) en na 2 min (`STALE_MS`) krijgen uitspraken géén locatie meer. Ook de verse meting lukt dan niet; er komt geen `gps_error`. Op een Mac zonder GPS en stilzittend logisch, maar hetzelfde kan op de telefoon gebeuren als je lang stilstaat (bij een plas). Voorstel: altijd terugvallen op de laatst bekende positie (met de echte meettijd, zodat de leeftijd zichtbaar is) in plaats van niets; per uitspraak vastleggen hoe de positie tot stand kwam (vers / laatst bekend / geen) en hoe lang het duurde. Op de telefoon nagaan of het daar ook gebeurt.
- **Interpretatie, voor de prompt:**
  - "een roek en een kraai" → Kraai onbekend; "kraai" = Zwarte Kraai (208). Idem "groepje kraaien". **Besloten:** kraai is altijd Zwarte Kraai, tenzij expliciet "bonte kraai".
  - "ja dat klopte" → genegeerd, maar "vorige waarneming is correct" → onzeker-vlag eraf. Bevestigingen consistent maken: onzeker eraf bij #1.
  - "phylloscopus" → Tjiftjaf of Fitis; "phylloscoop" → Boszanger onbekend. **Besloten:** phylloscopus/phylloscoop = Tjiftjaf of Fitis (595858); een bijzondere boszanger wordt later gecorrigeerd.
  - "sibopi" → Siberische Boompieper (goed, met onzeker). Vogelaarsjargon wordt veel gebruikt (eigenaar: "mibo", "tova", "rbt'tje", "robotap", …). Plan: bijnamenlijst `data/bijnamen.json` (bijnaam → soort-ID), door de eigenaar aan te vullen, in de systeemprompt en later in de Whisper-prompt.
  - "twee duiven" → Houtduif, onzeker: redelijk (er is geen Duif onbekend).
  - "het waren twee mannetjes en de rest vrouwtjes" → netjes gesplitst in 2 ♂ + 5 ♀. "Nee het zijn er 7" goed.
  - "mogelijk woudaap, bij thuiskomst geluiden terugluisteren" → Woudaap onzeker; de opdracht "terugluisteren" gaat verloren. Idee: vrij opmerkingenveld bij een waarneming (waarneming.nl heeft er een).
  - Vragen ("hoeveel soorten hebben we nu gezien?") worden terecht genegeerd.

## Opname (stap 4, 10 okt)

- Lokaal getest met een nep-microfoon (macOS-stem Xander): "zes overvliegende houtduiven en een roepje tjiftjaf" en "nee, keep in plaats van tjiftjaf" werden goed verstaan en verwerkt. Spraakherkenning ±2,1 s, interpretatie ±2,7 s.
- Nog niet getest met een echte microfoon (kan niet in de browser van Claude). Op de telefoon letten op: wordt het begin van de zin afgekapt (de microfoon gaat pas aan bij het indrukken), wind, en of de toestemmingsvraag één keer komt.
- Whisper-prompt: soortnamen (zeldzaamheid 1–2, ±270) en alle bijnamen. Zeldzame soorten staan er niet in; als die slecht verstaan worden, de lijst uitbreiden.

## Dev notes voor later (11 okt)

- **Alle methoden en gedragingen van waarneming.nl overnemen.** Nu gebruikt de app een deel (`FIELD_ACTIVITIES`, `FIELD_METHODS`, `FIELD_LIFE_STAGES` in `src/lib/vocab.ts`): 20 van de 49 gedragingen, 3 van de 18 methoden, 8 van de 25 kleden/leeftijden. De volledige lijsten staan al in `data/attributen-vogels.json`. Afwegen: alles in het formulier, en in de prompt alleen wat je in het veld zegt (meer opties in de prompt = meer kans op verkeerde keuzes).
- **Afkortingen voor leeftijd en kleed** in de prompt (en eventueel de Whisper-prompt), zoals bij de bijnamen. Voorstel, met de ID's van waarneming.nl:
  - 1kj / eerste kalenderjaar → 14, 2kj → 15, 3kj → 16, 4kj → 72, 5kj → 1175
  - 1w / eerste winter → 8, 2w / tweede winter → 10, 3w / derde winter → 62
  - 1z / eerste zomer → 9, 2z / tweede zomer → 11, eerste najaar → 7
  - juv / juveniel → 5, ad / adult → 2, subad / imm → 6, pull / pullus → 1009, eclips → 12
  - Nagaan hoe vogelaars het uitspreken ("eenkaa-jee", "eerstejaars", "eerste-winter") en dat met de testset controleren.

## Open vragen / losse eindjes

- Ideeën voor flow en indeling (menu, vorige wandelingen opruimen, locatienaam bij start, reviewscherm met kaart en eigen notities) vastgelegd in `docs/ideeen-flow.md` (10 okt). Voor later, nog niet gepland.

- Tests: nu nog geen geautomatiseerde tests (bewust, 9 okt). Later: Vitest voor de logica (dev-note-herkenning, validatie van tool calls, toevoegen/aanpassen/ongedaan maken met fake-indexeddb), een paar Playwright-tests met nep-antwoorden voor `/api`, en GitHub Actions. Los daarvan de testset als eval voor prompt en model (stap 7).

- Biedt de importpagina van waarneming.nl (alleen ingelogd) andere formaten dan eBird-CSV?
- Cloudflare-previews werken weer (branch `locatie` bouwde via `wrangler preview`). Vermoedelijk onthoudt Cloudflare het deploy-commando per branch vanaf de eerste build: een branch die met een oude instelling begon, blijft die houden. Bij problemen: nieuwe branch maken.
- Interpretatie: het model laat optionele velden graag weg; daarom zijn activiteit, methode en telmethode verplicht bij `add_observation`. Bij `update_observation` blijven ze optioneel.
- Testgeval terugblik: "vannacht op de nocmig een waterral overvliegend, half 3 's nachts een roepje" werd 1 × Waterral om 17:14, overvliegend, gezien en gehoord, onzeker (twijfel of het om twee vogels ging). Bedoeld: 1 × Waterral om 02:30, overvliegend, methode 588 "op geluidsrecorder". Oplossing: optioneel tijdveld in `add_observation` (model krijgt huidige datum/tijd mee, app rekent om) en methode 588 toestaan met "nocmig" → 588 in de prompt. Valt buiten de MVP-kern; meenemen als de testset er is.
- "Ongedaan maken" van een ongedaan-maken wordt niet ondersteund; een tweede "undo" gaat een uitspraak verder terug.
- Opmerkingenveld bij een waarneming (branch `opmerkingen`): "mogelijk woudaap, bij thuiskomst terugluisteren" → Woudaap onzeker met opmerking. Een latere opmerking ("die zat op het hek") vult aan en laat de twijfel staan. Bij de CSV-export (stap 6) mee in `Species Comments`.
- Idee eigenaar (10 okt): een onterecht gestopte wandeling weer kunnen voortzetten. Klein: knop "Wandeling voortzetten" bij een eerdere wandeling (status terug naar `active`, `endedAt` weg); alleen als er geen andere wandeling loopt. Eventueel alleen bij de meest recente of binnen een paar uur.
- Idee eigenaar (10 okt): bij een waarneming laten zien wáár hij was; nog bepalen hoe gedetailleerd. De coördinaten worden al bewaard, het gaat om de weergave. Opties, van eenvoudig naar meer werk:
  1. De "±35 m" bij een waarneming tikbaar maken → kaart (Google Maps/OSM). Dat werkt al zo bij dev notes (`mapsUrl`), nog niet bij waarnemingen.
  2. Een plaats- of straatnaam erbij ("Bergen, Duinweg"), via reverse geocoding: PDOK Locatieserver (NL, gratis, geen sleutel) of Nominatim (OSM). Eén keer opvragen en bij de waarneming bewaren.
  3. Het gebied van waarneming.nl ("Schoorlse Duinen"), het detailniveau dat de site zelf gebruikt. Kan via hun API (onderzoeken; vermoedelijk met inloggen).
  4. Een kleine kaart met alle waarnemingen van een wandeling (Leaflet + OSM), bij de review. Stond al op de roadmap.
  Voorstel: nu 1 (klein), en 2 of 3 bij de review (stap 5). Echte offline-ondersteuning valt buiten de MVP, dus de naam opvragen bij het verwerken kan.
- Idee eigenaar (10 okt): interne statistieken van alle ingevoerde soorten, over alle gebruikers heen, om bij veel gebruik te zien wat uit de soortenlijst, bijnamen en Whisper-prompt kan (nooit gebruikt) of erbij moet (vaak "Gezegd: …" in de twijfelreden, vaak met de hand gecorrigeerd). Pas relevant bij meer gebruikers (multi-user valt buiten de MVP). Aanzet:
  - Tellen per soort-ID: door het model gekozen, met de hand gecorrigeerd (van → naar), onzeker, en soorten die het model niet kon plaatsen. Die laatste zijn het waardevolst voor wat er bij moet.
  - Waar: de proxy (`worker/index.ts`) ziet elke `/api/messages`-aanroep al en kan soort-ID's uit de tool calls tellen (Workers Analytics Engine of D1). Correcties gebeuren in de app; die zou de app los moeten melden.
  - Privacy: alleen geaggregeerde tellingen, geen locaties, tijden of audio; gebruikers hierover informeren.
  - Tot die tijd geeft de JSON-export van de eigen wandelingen hetzelfde beeld voor één gebruiker (past bij de testset, stap 7).
- Idee eigenaar (11 okt): uitleggen en benadrukken waarom gemakkelijk invoeren goed is voor citizen science. Kernpunten:
  - Meer en vollediger gegevens: veel vogelaars noteren alleen de opvallende soorten, omdat alles intypen in het veld te veel moeite is. Inspreken kost seconden, dus ook algemene soorten (merel, houtduif, vink) komen erin. Juist die tellingen zijn nodig om trends te zien.
  - Minder vertekening: wat makkelijk in te voeren is, wordt vaker ingevoerd. Zeldzaamheden worden nu meer gemeld dan algemene soorten, en dat vertekent het beeld.
  - Betere gegevens: tijd en GPS worden op het moment zelf vastgelegd, in plaats van achteraf uit het geheugen ingevuld of op één punt voor de hele wandeling gezet.
  - Meer mensen doen mee: ook beginners en vogelaars die niet graag op een scherm tikken. Blijven kijken in plaats van typen houdt het leuk.
  - Waar: korte tekst in de README of een "Over"-scherm in het menu. Later in een eventuele presentatie aan waarneming.nl of Observation.org (bijvoorbeeld bij het aanvragen van API-toegang).
- Idee eigenaar (11 okt): feedback van betatesters. Raakt aan "geen multi-user" uit de MVP-scope, dus pas na overleg en na de mijlpaal (3–4 wandelingen).
  - **Tester:** het scherm "Dev notes" wordt "Feedback". Bekijken, verwijderen, nieuwe toevoegen (typen of inspreken) bestaat deels al (`#devnotes`); verwijderen en typen erbij. Knop "Inzenden": feedback plus een complete datadump (zelfde JSON als de export in Instellingen, met audio) naar de server. Vooraf tonen wat er meegaat (audio en locaties zijn persoonlijk) en om toestemming vragen.
  - **Developer:** een scherm met alle inzendingen (per tester, datum, appversie, aantal feedbackpunten), met per inzending: feedback lezen, de dump in de eigen app laden (de JSON-import van #40 bestaat al) en exporteren naar Claude: feedback als Markdown plus de JSON, zodat een ontwikkelsessie ze samen kan analyseren.
  - **Opslag:** de Worker krijgt een route `/api/feedback`; JSON in D1 of R2, audio in R2. Zonder accounts: per tester een eigen toegangscode, zodat je ziet van wie iets komt en één tester kunt uitsluiten. Het developerscherm achter een aparte beheercode.
  - **Kleiner begin:** "Inzenden" maakt alleen een bestand (Markdown + JSON) dat de tester deelt via het Android-deelmenu (mail, WhatsApp). Geen serveropslag nodig; de developer importeert het met de bestaande JSON-import.
- Idee eigenaar (11 okt), klein: bij "Vorige wandelingen → Opruimen" (`src/lib/PastSessions.svelte`) naast "Alle geëxporteerde aanvinken" ook "Alle lege aanvinken" en "Alles aanvinken" (eigenlijk een schakelaar: alles aan/uit). "Leeg" = 0 waarnemingen (`countPerSession`). Let op: dev notes zijn uitspraken en gaan mee als een wandeling wordt verwijderd. Een wandeling met alleen dev notes dus niet als leeg tellen, of in de bevestiging melden hoeveel dev notes er mee weggaan.
- Idee eigenaar (11 okt): privacypagina (in het menu, en een link bij de eerste start) die precies uitlegt wat er met opnames en locaties gebeurt en welke controle de gebruiker heeft. Huidige stand, uit de code:
  - **Op het toestel:** audio, transcript, tijd, GPS, waarnemingen en het gebeurtenissenlog staan in IndexedDB in de browser. Geen accounts, geen GPS-track, geen analytics.
  - **Naar buiten, via de eigen proxy (`worker/index.ts`):** audio → OpenAI (`/api/transcribe`, voor de tekst); transcript plus de laatste waarnemingen van de wandeling → Anthropic (`/api/messages`); coördinaten → waarneming.nl (`/api/area`, voor de gebiedsnaam). De proxy bewaart zelf niets. Nagaan: logt Cloudflare verzoeken (Workers Logs / observability in `wrangler.jsonc`)?
  - **Bij de API-aanbieders:** nagaan en met bron vermelden hoe lang OpenAI en Anthropic API-gegevens bewaren en dat ze die standaard niet gebruiken om modellen te trainen. Niet uit het hoofd opschrijven; beleid verandert.
  - **Alleen op eigen initiatief:** CSV naar waarneming.nl (geen audio), JSON-export, kaartlinks naar Google Maps/OSM.
  - **Controle:** wandelingen verwijderen (echt weg, met audio), prullenbak voor waarnemingen, export van alles. Mogelijke uitbreidingen: alleen audio wissen en transcripten bewaren, audio automatisch wissen na X dagen of na export, alles wissen met één knop, en "audio niet bewaren" als instelling (raakt aan de testset, stap 7).
  - Hangt samen met het feedbackidee (inzenden met audio en locaties) en met de soortenstatistieken: die pagina moet ook dat uitleggen zodra het er is. Bij echte betatesters is zo'n pagina eigenlijk verplicht (AVG: audio en locatie zijn persoonsgegevens).
- Idee eigenaar (11 okt): pagina "Hoe werkt het" in het menu, voor de geïnteresseerde leek die ChatGPT of Claude wel eens heeft gebruikt. Doel: uitleg over het gebruik én open zijn over het gebruik van AI. Kort, geen technisch verhaal. Opzet:
  - **Gebruik:** knop tikken of vasthouden en inspreken. Voorbeelden: "zes overvliegende houtduiven", "roepje vink", "schatting 500 spreeuwen", "nee, keep in plaats van vink", "nog drie erbij", "verwijder die laatste", "mogelijk woudaap" (wordt onzeker). Jargon en bijnamen werken ("tova", "KBV"). Trillen: één keer = opgeslagen, twee keer = niet begrepen, afwijkend = onzeker. "Dev note …" (later "feedback") = opmerking over de app. Thuis: nalopen, onzekere waarnemingen bekijken, exporteren naar waarneming.nl.
  - **Wat er onder de motorkap gebeurt**, in drie stappen:
    1. *Spraak naar tekst:* een spraakherkenningsmodel van OpenAI (familie van Whisper) maakt tekst van je opname. Het krijgt een lijst vogelnamen mee, zodat "tjiftjaf" niet "tsjif tsjaf" wordt.
    2. *Tekst naar waarneming:* een taalmodel (Claude van Anthropic, net als in de chat-app, maar een klein en snel model) leest de zin en kiest een actie: toevoegen, aanpassen, verwijderen. Het mag alleen kiezen uit een vaste lijst Nederlandse soorten, dus het kan geen soorten verzinnen. Weet het iets niet zeker, dan zet het een vlag in plaats van te gokken.
    3. *De app zelf* (geen AI): tijd en GPS bij het begin van de opname, controleren, opslaan, gebiedsnaam van waarneming.nl, export.
  - **Grenzen, eerlijk benoemd:** AI maakt fouten (verkeerd verstaan, verkeerde soort, aantallen). Daarom: altijd zelf nalopen voor je inzendt; jij blijft verantwoordelijk voor wat er op waarneming.nl komt. Geen soortherkenning op geluid (dat doen apps als Merlin of BirdNET); Fluistervink verwerkt alleen wat jíj zegt.
  - Verwijst naar de privacypagina voor wat er met opnames gebeurt; eventueel worden het twee kopjes op één pagina. Sluit aan bij het citizen-science-idee (waarom makkelijk invoeren telt).

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen (`.dev.vars`, `.env`) staan niet in git; per computer zelf aanmaken.
