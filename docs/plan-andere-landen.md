# Plan: vogels van andere landen, in andere talen

Voorstel van 19 nov 2026, nog niet goedgekeurd. Punt 7 van "Na v1.0" in `docs/roadmap.md`, en het vervolg op `docs/plan-engels.md`. Dit plan vervangt het idee "Vogels van andere landen" uit `docs/ideeen.md`.

## Doel

Twee dingen die op elkaar lijken, maar los te zetten zijn:

- **Land:** welke soorten de app verwacht en hoe zeldzaam ze zijn. Een Nederlander op vakantie in Spanje spreekt "drie bijeneters" in, en de app kent de Spaanse lijst.
- **Taal van de namen:** in welke taal je de soorten noemt. Een Engelsman in Nederland zegt "Lapwing", een Duitser "Kiebitz".

Het datamodel hoeft daarvoor niet te veranderen: soorten zijn al waarneming.nl-ID's, en die zijn wereldwijd dezelfde.

## Wat waarneming.nl ons geeft

Nagegaan op 19 nov met de openbare API, zonder sleutel:

- **Regio's:** `GET /api/v1/regions/` geeft continenten en landen, met ISO-code ("Albania", `AL`, regio 70).
- **Regiolijsten:** `GET /api/v1/region-lists/` geeft per regio en soortgroep een lijst-ID (Nederland, vogels: 5001). Elke lijst geeft de soorten van dat land met hun zeldzaamheid **in dat land**. Dat is precies wat `scripts/fetch-species.mjs` nu voor Nederland doet.
- **Namen per taal:** dezelfde aanroepen met `Accept-Language: en` of `de` geven de namen in die taal ("Mute Swan", "Höckerschwan"), ook voor gedrag, methode en kleed. Welke talen er zijn, nog nalopen (de site kent er minstens tien).

Dus: geen tweede bron nodig, en de export naar waarneming.nl en observation.org werkt overal (dezelfde database, die neemt waarnemingen van over de hele wereld aan).

## Proef Spanje (19 nov): zeldzaamheid uit aantallen

**Probleem:** de zeldzaamheid in de regiolijsten is buiten Nederland en België grotendeels leeg. In Spanje hebben 316 van de ~1000 soorten zeldzaamheid 0 (onbekend), waaronder bijeneter, blauwe ekster, rode patrijs, flamingo, monniksgier en zwarte ibis; maar 67 soorten staan op algemeen. Portugal en Frankrijk zijn net zo; België is wel goed ingevuld. Het filter van Nederland (zeldzaamheid 1–3) zou in Spanje dus juist de typische soorten weglaten.

**Oplossing:** de API geeft per soort en land het aantal waarnemingen, zonder sleutel: `GET /api/v1/species/<id>/observations/?country=ES&limit=1` → `count` (ook met `date_after`). Eén aanroep per soort: voor Spanje 1119 aanroepen, 3 minuten met 4 tegelijk; voor Nederland 5 minuten. Prima voor de wekelijkse workflow.

**Regel** (als aandeel van alle waarnemingen in dat land, zodat een land met weinig waarnemers dezelfde maat krijgt):

- In de prompt: inheems en ≥ 2 per 100.000 waarnemingen; niet-inheems ≥ 10 per 100.000 (gevestigde exoten zoals monniksparkiet, Sint-Helenafazantje en halsbandparkiet komen er dan vanzelf in, ontsnapte enkelingen niet); verzamelsoorten (type M) ook ≥ 2 per 100.000.
- Zeldzaamheid: ≥ 150 per 100.000 algemeen, ≥ 30 vrij algemeen, ≥ 5 zeldzaam, daaronder zeer zeldzaam. Geijkt op Nederland: alle 110 algemene soorten van de bron komen er als algemeen uit, de zeldzame grotendeels als zeldzaam.

**Uitkomst Spanje:** 373 soorten en 34 verzamelsoorten in de prompt (Nederland nu ongeveer 350). Bijeneter, blauwe ekster, rode patrijs, Iberische tjiftjaf, Spaanse keizerarend, grote en kleine trap, witkopeend, zandhoenders, Audouins meeuw: allemaal erin, de meeste als algemeen. Dupont's leeuwerik (78 waarnemingen) valt er net onder en gaat dan via `findVagrant`.

**Kanttekeningen:**

- **Twitchers tellen mee:** een zeldzame vogel die door honderd mensen gemeld wordt, telt honderd keer. In Nederland komen zo bv. sneeuwuil, roze pelikaan en Ross' gans boven de drempel. Voor een vakantieland niet erg: de prompt wordt er iets groter van, het model kiest ze alleen als je ze noemt, en "zeldzaam" maakt ze onzeker. Voor Nederland houden we de bron.
- **Waar Nederlanders gaan, wordt meer geteld:** Extremadura en de kust tellen zwaarder dan Galicië. Algemene soorten zitten er toch ruim in; het verschil zit in de staart.
- **Canarische Eilanden** horen bij het land ES: Atlantische kanarie, Berthelots pieper en Canarische tjiftjaf staan dus ook in de lijst voor het vasteland (klein nadeel). De Canarische Eilanden (regio 110, lijst 244), de Azoren (lijst 361) en de Balearen zijn aparte regio's met een eigen lijst; later eventueel als eigen keuze. Het filter `region=` bij de aantallen is nog niet goed nagegaan.
- Getallen van Nederland en Spanje staan niet in git; het script maakt ze opnieuw.

## Keuzes

### 1. Lijst en namen apart bewaren

Nu staan soort, naam en zeldzaamheid samen in `data/soorten-nl.json`. Wordt:

- **Per land:** `soorten-<land>.json` met alleen ID, type, groep en zeldzaamheid in dat land (en welke in de prompt komen).
- **Per taal:** `namen-<taal>.json` met per ID de naam, en `bijnamen-<taal>.json`.
- `src/lib/vocab.ts` voegt ze samen tot wat de rest van de app nu gebruikt, zodat er buiten `vocab.ts` weinig verandert.

Zo is elke combinatie mogelijk zonder voor elk paar een bestand te maken: een Nederlander in Spanje is `soorten-es` met `namen-nl`.

### 2. Niet alles meebundelen, wel van de eigen site

Nederland met de Nederlandse en de Engelse namen blijft in de app zitten (de meeste gebruikers, en het werkt offline vanaf het begin). Andere landen en talen:

- De wekelijkse workflow (`.github/workflows/soortenlijst.yml`) haalt ze op en zet ze als statische bestanden op de site (`/lijsten/es.json`, `/lijsten/namen-de.json`). Geen nieuwe route in de proxy, geen nieuwe externe bron in de CSP.
- De app downloadt een lijst als je hem kiest en bewaart hem in IndexedDB, zodat hij op de bestemming werkt zonder bereik. "Download vóór vertrek" bij Instellingen, met de grootte.
- Beginnen met een handvol landen waar Nederlanders vogelen (Spanje, Portugal, Frankrijk, Duitsland, Polen, Griekenland, het Verenigd Koninkrijk, Marokko) en uitbreiden op verzoek.

### 3. Land kiezen

- Bij Instellingen een land, standaard Nederland.
- Bij het starten van een sessie buiten het land van de lijst: een vraag ("Je bent in Spanje. Spaanse vogellijst gebruiken?") met één tik ja. Met bereik downloadt hij dan meteen; zonder bereik blijft de oude lijst en zegt de app dat.
- **Per sessie bewaren** welke lijst en welke taal gebruikt zijn (`Session.region`, en `Utterance.language` uit het Engelse plan). Nodig voor de testset, voor het log en voor wie later terugkijkt.
- Belgen: België heeft een eigen regiolijst. Voor iemand die in de Ardennen vogelt kan dat al verschil maken; een goede eerste proef van het mechanisme, met dezelfde taal.

### 4. Wat er per land en taal verandert

- **Prompt voor het model:** een andere soortenlijst, dus een eigen cache bij Anthropic per combinatie (de eerste uitspraak van een sessie is iets duurder). De promptversie krijgt land en taal erbij.
- **Prompt voor de spraakherkenning:** de namen van dat land in die taal, en de taal zelf (de proxy laat per taal door, zie `docs/plan-engels.md`).
- **Zeldzaamheid:** "zeldzame soort wordt onzeker", `findVagrant` en de kleuren in de lijst rekenen met de zeldzaamheid van het land van de sessie. Een bijeneter is in Spanje gewoon, in Nederland zeldzaam.
- **Andere diergroepen:** in het begin alleen vogels buiten Nederland; de lijsten voor zoogdieren, vlinders en libellen per land zijn er wel, maar nog niet nagegaan of ze goed genoeg zijn.
- **Gedrag, methode en kleed** zijn per soortgroep, niet per land: alleen de namen per taal.

## Talen

**Eerst Engels** (`docs/plan-engels.md`): de namen met `Accept-Language: en`, Britse namen met de eBird-namen als bijnamen.

**Dan pas andere talen, op verzoek.** Elke taal kost hetzelfde als Engels: alle schermen, een systeemprompt, bijnamen en vooral **een eigen testset met sprekers**. Kandidaten:

- **Frans**, voor Wallonië: waarnemingen.be is tweetalig, en België staat al open in Play.
- **Duits**: veel vogelaars, maar daar is ornitho.de de standaard en niet observation.org, dus de export is minder vanzelfsprekend.
- **Spaans, Pools, Scandinavische talen**: alleen als er gebruikers om vragen.

Een tussenvorm is goedkoop: **soortnamen in een andere taal, de rest in het Engels**. Voor een Duitser die Engels leest maar liever "Rotkehlchen" zegt. De schermen blijven Engels; alleen de lijst, de bijnamen en de taal van de spraakherkenning wisselen. Wel met de systeemprompt in het Engels (het model begrijpt de Duitse uitspraak toch) en een kleine testset. Dit eerst proberen, vóór een volledige vertaling.

## Haken en ogen

- **Taxonomie** is overal dezelfde (AviList, van waarneming.nl), dus geen probleem binnen de app. eBird gebruikt Clements; die vertaaltabel is nodig zodra eBird-gebruikers buiten Europa komen (zie `docs/plan-ebird.md`).
- **Grootte van de prompt:** voor Nederland staan er zo'n 350 vogels in de prompt (`docs/waarneming-nl.md`). Een tropisch land heeft er al gauw 800. Dan scherper filteren (alleen de algemene en vrij algemene, de rest via `findVagrant`) of de lijst per streek nemen. Eerst meten bij een groot land.
- **Kwaliteit van de lijsten:** de zeldzaamheid uit de bron is buiten Nederland en België vaak leeg; daarom de aantallen (zie Proef Spanje). Steekproef per land vóór het openzetten, zeker in landen met weinig waarnemers.
- **Exoten en gevestigde soorten:** het script heeft een eigen lijst voor Nederland (Nijlgans, Halsbandparkiet). Per land nalopen, of het filter "inheems" van de API vertrouwen.
- **Testset:** opnames uit het buitenland zijn er nog niet. De eigenaar en testers op vakantie leveren ze; tot die tijd met synthetische uitspraken (de testset kan dat al).
- **Landen in Play:** pas meer landen openzetten als hun lijst er is; anders werkt de zeldzaamheid verkeerd.
- **Privacy:** de lijsten komen van de eigen site, dus er gaat niets nieuws de deur uit. Wel in `#privacy` noemen dat het land van de sessie in het log komt.

## Stappen

1. **Lijst en namen apart** in `fetch-species.mjs` en `vocab.ts`, met Nederland en Nederlands; verder niets zichtbaars. Tests voor de samenvoeging. Begonnen 19 nov met het Engels (`data/namen-en.json`, `speciesNameIn` in `vocab.ts`, stap 2 van `docs/plan-engels.md`); de Nederlandse namen staan nog in `soorten-nl.json`.
2. **Engelse namen** (hoort bij stap 2 van `docs/plan-engels.md`).
3. **België** als tweede land, gebundeld: de keuze bij Instellingen en de vraag bij het starten, als ontwikkeloptie.
4. **Downloadbare lijsten** van de eigen site, met de opslag in IndexedDB, voor de eerste reeks vakantielanden. Lijst en zeldzaamheid uit de aantallen (Proef Spanje), behalve voor Nederland en België.
5. **Proef op vakantie** (eigenaar of testers), testset aanvullen, dan voor iedereen.
6. **Soortnamen in een andere taal** (Duits of Frans) met Engelse schermen, als iemand erom vraagt.

## Open vragen

- Welke talen kent de API van waarneming.nl, en zijn de namen in elke taal compleet?
- Een gebied binnen een land (een Spaanse provincie): heeft waarneming.nl regiolijsten op dat niveau, en is dat nuttig?
- Hoe groot is een landenlijst als bestand, en hoe lang duurt de download met slecht bereik?
- Aantallen over alle jaren (nu) of de laatste tien jaar (`date_after`)? Alle jaren is stabieler; tien jaar volgt verschuivingen. Eerst alle jaren.
