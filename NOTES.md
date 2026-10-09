# Stand van zaken

Werklog om tussen computers te kunnen schakelen. Werk dit bij aan het eind van elke werksessie, vóór het pushen.

## Waar ik ben

- Stap 1 (projectopzet) en stap 2 (proxy) gemerged (PR #2, #3, #4).
- Locatie gemerged (PR #6) en gedeployd: GPS warm tijdens de wandeling, positie (met nauwkeurigheid en meettijd) bij elke uitspraak en waarneming. Getest met nep-GPS: verse meting, stilstaan, trage meting, geen toegang.
- Stap 3 (interpretatie met tekstinvoer) gemerged (PR #5) en gedeployd: tijdens een wandeling typ je een uitspraak, Claude Haiku 5.5 zet hem om in tool calls (`add_observation`, `update_observation`, `delete_observation`, `undo`), de app valideert en voert ze uit. Lokaal getest met echte sleutels: 13 testuitspraken (toevoegen, correctie, "nog drie erbij", verwijderen, ongedaan maken, gepraat negeren) gingen allemaal goed, ±2 s per uitspraak. Prompt caching werkt (~6900 tokens uit de cache).

## Volgende stap

0. Dev notes (PR #7), alles terugzien (PR #8) en meten (PR #9) gemerged. Locatie-terugval in PR #10: reviewen en mergen. Daarna een prompt-PR met de interpretatiepunten van de testronde op de bank + bijnamenlijst. Daarna op de telefoon "dev note, …" uitproberen en meteen de traagheid testen (zie bevinding 2): per uitspraak staat nu de duur in de lijst, en of de app op de achtergrond stond. JSON-export (Instellingen) aan Claude geven voor analyse.

1. Op de telefoon controleren of de nauwkeurigheid klopt (buiten vaak 3–10 m).
2. Op de telefoon uitproberen met eigen zinnen; opvallende fouten noteren voor de prompt.
3. Op elke computer `.dev.vars` aanmaken (zie README).
4. Stap 4: opname en Whisper-koppeling. `currentPosition()` aanroepen bij het indrukken van de opnameknop. De transcriptie komt dan in `utterance.transcript` en loopt verder door dezelfde wachtrij. Daarna: 5 review (incl. afgelopen wandelingen openen), 6 CSV-export, 7 testset (volgorde aangepast op 9 okt, zie `CLAUDE.md`).

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

## Open vragen / losse eindjes

- Tests: nu nog geen geautomatiseerde tests (bewust, 9 okt). Later: Vitest voor de logica (dev-note-herkenning, validatie van tool calls, toevoegen/aanpassen/ongedaan maken met fake-indexeddb), een paar Playwright-tests met nep-antwoorden voor `/api`, en GitHub Actions. Los daarvan de testset als eval voor prompt en model (stap 7).

- Biedt de importpagina van waarneming.nl (alleen ingelogd) andere formaten dan eBird-CSV?
- Cloudflare-previews werken weer (branch `locatie` bouwde via `wrangler preview`). Vermoedelijk onthoudt Cloudflare het deploy-commando per branch vanaf de eerste build: een branch die met een oude instelling begon, blijft die houden. Bij problemen: nieuwe branch maken.
- Interpretatie: het model laat optionele velden graag weg; daarom zijn activiteit, methode en telmethode verplicht bij `add_observation`. Bij `update_observation` blijven ze optioneel.
- Testgeval terugblik: "vannacht op de nocmig een waterral overvliegend, half 3 's nachts een roepje" werd 1 × Waterral om 17:14, overvliegend, gezien en gehoord, onzeker (twijfel of het om twee vogels ging). Bedoeld: 1 × Waterral om 02:30, overvliegend, methode 588 "op geluidsrecorder". Oplossing: optioneel tijdveld in `add_observation` (model krijgt huidige datum/tijd mee, app rekent om) en methode 588 toestaan met "nocmig" → 588 in de prompt. Valt buiten de MVP-kern; meenemen als de testset er is.
- "Ongedaan maken" van een ongedaan-maken wordt niet ondersteund; een tweede "undo" gaat een uitspraak verder terug.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen (`.dev.vars`, `.env`) staan niet in git; per computer zelf aanmaken.
