# Plan: vogels van andere landen, in andere talen

Voorstel van 19 nov 2026, uitgewerkt op 20 nov; **voor later**. Eerst blijft de focus op Nederland; de eerste uitbreiding wordt West-Europa. De proef met Spanje werkte (zie hieronder); het vinkje is op 20 nov weer weggehaald, de testset kan Spanje nog gebruiken (`--land es`). Punt 7 van "Na v1.0" in `docs/roadmap.md`, en het vervolg op `docs/plan-engels.md`. Dit plan vervangt het idee "Vogels van andere landen" uit `docs/ideeen.md`.

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

**Uitkomst Spanje** (`data/soorten-es.json`): 373 soorten, 3 gedomesticeerde vormen en alle verzamelsoorten van de Nederlandse prompt plus de Spaanse (samen 411 in de prompt; Nederland nu 354). Bijeneter, blauwe ekster, rode patrijs, Iberische tjiftjaf, Spaanse keizerarend, grote en kleine trap, witkopeend, zandhoenders, Audouins meeuw: allemaal erin, de meeste als algemeen. Dupont's leeuwerik (78 waarnemingen) valt er net onder en gaat via `findVagrant`. Een verzamelsoort krijgt geen zeldzaamheid (0): "Eend onbekend" kwam anders als zeer zeldzaam uit en werd dan altijd onzeker.

**Kanttekeningen:**

- **Twitchers tellen mee:** een zeldzame vogel die door honderd mensen gemeld wordt, telt honderd keer. In Nederland komen zo bv. sneeuwuil, roze pelikaan en Ross' gans boven de drempel. Voor een vakantieland niet erg: de prompt wordt er iets groter van, het model kiest ze alleen als je ze noemt, en "zeldzaam" maakt ze onzeker. Voor Nederland houden we de bron.
- **Waar Nederlanders gaan, wordt meer geteld:** Extremadura en de kust tellen zwaarder dan Galicië. Algemene soorten zitten er toch ruim in; het verschil zit in de staart.
- **Canarische Eilanden** horen bij het land ES: Atlantische kanarie, Berthelots pieper en Canarische tjiftjaf staan dus ook in de lijst voor het vasteland (klein nadeel). De Canarische Eilanden (regio 110, lijst 244), de Azoren (lijst 361) en de Balearen zijn aparte regio's met een eigen lijst; later eventueel als eigen keuze. Het filter `region=` bij de aantallen is nog niet goed nagegaan.
- Getallen van Nederland en Spanje staan niet in git; het script maakt ze opnieuw. De API gaf na ruim tweeduizend aanroepen achter elkaar een 429; het script doet er twee tegelijk en wacht zo lang als de server vraagt.

**De proef in de app** (19 nov, ontwikkeloptie "Spanje"): `src/lib/region.ts` kiest het land bij het laden; `speciesListsFor` in `vocab.ts` geeft de Spaanse vogels met de andere diergroepen van Nederland. Prompts, "zeldzaam wordt onzeker", dwaalgasten en de kleuren volgen vanzelf. Elke uitspraak bewaart het land (`Utterance.region`), de testset kiest het met `--land es`. Nog niet: de vraag bij het starten in het buitenland, downloaden in plaats van meebundelen (het bestand is 126 kB, gecomprimeerd 22 kB), andere diergroepen van Spanje, en `#privacy` (alleen nodig als het voor iedereen komt).

**Testset, synthetisch** (40 zinnen zoals een Nederlander ze in Spanje inspreekt, `testset/spanje-synthetisch.json`, buiten git):

| | Spaanse lijst | Nederlandse lijst |
| --- | --- | --- |
| Model alleen (transcript gegeven) | 40/40 goed, 0 onzeker | 31/40 goed, 29 onzeker |
| Spraakherkenning + model (stem Xander van macOS) | 37/40 goed, 6 onzeker | 26/40 goed, 24 onzeker |
| Letterlijk verstaan | 31/40 | 27/40 |

Met de Nederlandse lijst werden blauwe ekster, rode patrijs en monniksparkiet "Vogel onbekend", kleine zwartkop werd zwartkop en witkopeend witoogeend. De fouten die met de Spaanse lijst overblijven, komen vooral van de stem van de Mac ("Viralijvers" voor vier ralreigers, "Peperkoek" voor purperkoet); echte opnames uit Spanje moeten het laten zien.

## Keuzes

### 1. Lijst en namen apart bewaren

Nu staan soort, naam en zeldzaamheid samen in `data/soorten-nl.json`. Wordt:

- **Per land:** `soorten-<land>.json` met alleen ID, type, groep en zeldzaamheid in dat land (en welke in de prompt komen).
- **Per taal:** `namen-<taal>.json` met per ID de naam, en `bijnamen-<taal>.json`.
- `src/lib/vocab.ts` voegt ze samen tot wat de rest van de app nu gebruikt, zodat er buiten `vocab.ts` weinig verandert.

Zo is elke combinatie mogelijk zonder voor elk paar een bestand te maken: een Nederlander in Spanje is `soorten-es` met `namen-nl`.

### 2. Lijsten als bestanden van de eigen site

Nederland blijft in de app zitten (de meeste gebruikers, en het werkt offline vanaf het begin). Andere landen:

- Per land een bestand op de site (`/lijsten/es.json`, gecomprimeerd 20–30 kB) en een overzicht (`/lijsten/index.json`: land, grootte, datum, kwaliteit "goed" of "proef"). Geen nieuwe route in de proxy, geen nieuwe externe bron in de CSP.
- De app bewaart een gekozen lijst in IndexedDB, zodat hij op de bestemming werkt zonder bereik. Een nieuwere versie haalt hij op wifi vanzelf op.
- **Eilanden** met een eigen lijst bij waarneming.nl (Canarische Eilanden 244, Azoren 361, Balearen) zijn een eigen keuze, net als een land.

### 3. Het land hoort bij de sessie

Nu kiest `region.ts` het land bij het laden van de app (zoals de taal). Voor echt gebruik moet het per sessie:

- **`Session.region`**, en elke uitspraak wordt verwerkt met het land van zijn sessie. Dan klopt ook de wachtrij: een uitspraak uit Spanje die thuis pas verwerkt wordt, houdt de Spaanse lijst (nu niet: daar geldt het land van de app op dat moment).
- `vocab.ts` geeft de lijsten per land in plaats van als vaste waarden bij het laden (`speciesListsFor` bestaat al); de prompt krijgt per land een eigen variant, zoals nu per taal (`variant` in `prompt.ts`), en dus een eigen promptversie en cache bij Anthropic.
- **Herkennen bij het starten:** de app ziet aan de GPS in welk land je bent, offline, met een kleine kaart van de landsgrenzen (alleen de landen die er zijn). Buiten het land van de laatste lijst: "Je bent in Spanje. Spaanse vogellijst gebruiken?", één tik. Is de lijst er niet en is er geen bereik, dan blijft de Nederlandse lijst met een duidelijke melding; er gaat niets verloren, thuis loop je het na.
- **Vóór vertrek** bij Instellingen: "Lijst voor je reis", een land kiezen en downloaden, met de grootte.
- Belgen: België heeft een eigen regiolijst met een goede zeldzaamheid; voor wie in de Ardennen vogelt al nuttig, en de eenvoudigste eerste proef van het mechanisme.

### 4. Maken van de lijsten, zuinig met de API

- **Zeldzaamheid:** voor Nederland en België die van de bron, voor de andere landen uit de aantallen (Proef Spanje).
- **Tellen kost ruim duizend aanroepen per land**, en de API gaf al een 429. Dus: per kwartaal tellen, één land per run, de aantallen bewaren; de wekelijkse workflow werkt alleen namen en ID's bij. Met waarneming.nl overleggen wat we doen; misschien hebben ze een betere manier.
- **Landen zonder eigen lijst** (Denemarken, Ierland, Polen, Finland, Slovenië e.a.): de soorten van de buurlanden nemen en tellen wat er echt voorkomt; het tellen gaat per land, ook zonder lijst.
- **Maximum in de prompt:** ongeveer 450 vogels. Komen er meer boven de drempel, dan gaat de drempel omhoog tot het past; de rest vindt de app op naam in de hele lijst van het land, zoals nu met dwaalgasten, en dan onzeker.
- **Controle per land** in het script: genoeg waarnemingen in totaal, een redelijk aantal algemene soorten, geen grote sprong ten opzichte van de vorige versie. Een land dat zakt, gaat niet mee.

### 5. Wat er per land en taal verandert

- **Prompt voor het model:** een andere soortenlijst, dus een eigen cache bij Anthropic per combinatie (de eerste uitspraak van een sessie is iets duurder). De promptversie krijgt land en taal erbij.
- **Prompt voor de spraakherkenning:** de namen van dat land in die taal, en de taal zelf (de proxy laat per taal door, zie `docs/plan-engels.md`).
- **Zeldzaamheid:** "zeldzame soort wordt onzeker", `findVagrant` en de kleuren in de lijst rekenen met de zeldzaamheid van het land van de sessie. Een bijeneter is in Spanje gewoon, in Nederland zeldzaam.
- **Andere diergroepen:** in het begin alleen vogels buiten Nederland; de lijsten voor zoogdieren, vlinders en libellen per land zijn er wel, maar nog niet nagegaan of ze goed genoeg zijn.
- **Gedrag, methode en kleed** zijn per soortgroep, niet per land: alleen de namen per taal.

## Welke landen

Nagegaan op 20 nov: waarnemingen per land bij waarneming.nl (de laatste tijd, niet alle jaren) en het aantal vogelsoorten op de lijst.

| Groep | Landen | Waarnemingen | Soorten op de lijst |
| --- | --- | --- | --- |
| Bron is goed | Nederland, België | miljoenen | ~900 |
| Veel gegevens | Duitsland, Frankrijk, Spanje, VK, Oostenrijk, Italië, Zweden, Zwitserland, Portugal, Griekenland, Noorwegen, Luxemburg | 20.000–1,3 mln | 450–900 |
| Redelijk | Kroatië, Hongarije, Roemenië, Tsjechië, Marokko, Georgië, Cyprus, Turkije, Armenië, Gambia, Oman, Zuid-Afrika | 5.000–17.000 | 400–1000 |
| Weinig gegevens, enorme lijst | Peru, Brazilië, Colombia, Ecuador, Kenia, Indonesië, India, VS | 1.000–13.000 | 1000–1900 |

Geen eigen lijst: Denemarken, Ierland, Polen, Finland, Slovenië, Bosnië, Letland; helemaal geen regio: Chili, Slowakije, Oekraïne, Vietnam.

- **Eerst West-Europa:** België, Duitsland, Frankrijk, Luxemburg, het VK, en daarna Spanje, Portugal, Zwitserland, Oostenrijk en Italië. Genoeg gegevens, soorten met bekende Nederlandse namen, en de export naar waarneming.nl werkt er gewoon.
- **Daarna** de rest van Europa en het Middellandse Zeegebied (Marokko, Turkije, Cyprus), met het label "proef" waar de gegevens dun zijn.
- **Niet beloven: de tropen en Amerika in het Nederlands.** Een lijst van 1000–1900 soorten, weinig waarnemingen om algemeen van zeldzaam te scheiden, en bijna niemand kent de Nederlandse naam van een tropische vogel. Dat hoort bij het Engels: de meest getelde soorten in de prompt, de rest op naam opzoeken, altijd onzeker. Eerst meten met een testset.
- **eBird** buiten Europa vraagt eerst een vertaling naar Clements (zie Haken en ogen).

## Talen

**Eerst Engels** (`docs/plan-engels.md`): de namen met `Accept-Language: en`, Britse namen met de eBird-namen als bijnamen.

**Dan pas andere talen, op verzoek.** Elke taal kost hetzelfde als Engels: alle schermen, een systeemprompt, bijnamen en vooral **een eigen testset met sprekers**. Kandidaten:

- **Frans**, voor Wallonië: waarnemingen.be is tweetalig, en België staat al open in Play.
- **Duits**: veel vogelaars, maar daar is ornitho.de de standaard en niet observation.org, dus de export is minder vanzelfsprekend.
- **Spaans, Pools, Scandinavische talen**: alleen als er gebruikers om vragen.

Een tussenvorm is goedkoop: **soortnamen in een andere taal, de rest in het Engels**. Voor een Duitser die Engels leest maar liever "Rotkehlchen" zegt. De schermen blijven Engels; alleen de lijst, de bijnamen en de taal van de spraakherkenning wisselen. Wel met de systeemprompt in het Engels (het model begrijpt de Duitse uitspraak toch) en een kleine testset. Dit eerst proberen, vóór een volledige vertaling.

## Haken en ogen

- **Taxonomie** is overal dezelfde (AviList, van waarneming.nl), dus geen probleem binnen de app. eBird gebruikt Clements; die vertaaltabel is nodig zodra eBird-gebruikers buiten Europa komen (zie `docs/archief/plan-ebird.md`).
- **Grootte van de prompt:** voor Nederland staan er zo'n 350 vogels in de prompt (`docs/waarneming-nl.md`). Een tropisch land heeft er al gauw 800. Dan scherper filteren (alleen de algemene en vrij algemene, de rest via `findVagrant`) of de lijst per streek nemen. Eerst meten bij een groot land.
- **Kwaliteit van de lijsten:** de zeldzaamheid uit de bron is buiten Nederland en België vaak leeg; daarom de aantallen (zie Proef Spanje). Steekproef per land vóór het openzetten, zeker in landen met weinig waarnemers.
- **Exoten en gevestigde soorten:** het script heeft een eigen lijst voor Nederland (Nijlgans, Halsbandparkiet). Per land nalopen, of het filter "inheems" van de API vertrouwen.
- **Testset:** opnames uit het buitenland zijn er nog niet. De eigenaar en testers op vakantie leveren ze; tot die tijd met synthetische uitspraken (de testset kan dat al).
- **Landen in Play:** pas meer landen openzetten als hun lijst er is; anders werkt de zeldzaamheid verkeerd.
- **Privacy:** de lijsten komen van de eigen site, dus er gaat niets nieuws de deur uit. Wel in `#privacy` noemen dat het land van de sessie in het log komt.

## Stappen

Voor later: eerst Nederland. De volgorde als we beginnen:

1. **Lijst en namen apart** in `fetch-species.mjs` en `vocab.ts`. Begonnen 19 nov met het Engels (`data/namen-en.json`, `speciesNameIn`); de Nederlandse namen staan nog in `soorten-nl.json`.
2. **Het land per sessie** (`Session.region`, verwerken met het land van de sessie, lijsten en prompt per land). Het fundament; lost ook de valkuil met de wachtrij op. Nog niets zichtbaars.
3. **België**, meegebundeld, achter een ontwikkeloptie: de vraag bij het starten en de keuze bij Instellingen.
4. **Lijsten als bestanden van de site**, met de controle en het maximum, voor West-Europa (zie Welke landen). Tellen per kwartaal.
5. **Downloaden vóór vertrek** en de proef op vakantie (eigenaar of testers), testset aanvullen met echte opnames, dan voor iedereen.
6. **Rest van Europa en het Middellandse Zeegebied**, eilanden, landen zonder eigen lijst via de buurlanden.
7. **Met het Engels:** soortnamen in een andere taal, en een proef met een groot land buiten Europa.

Gedaan: **Proef Spanje** (19 nov, #308): zeldzaamheid uit aantallen, `data/soorten-es.json`, testset 37/40 tegen 26/40 met de Nederlandse lijst. Het vinkje is weg (20 nov); het script maakt de Spaanse lijst nog wekelijks, de testset gebruikt hem met `--land es`.

## Open vragen

- Welke talen kent de API van waarneming.nl, en zijn de namen in elke taal compleet?
- Een gebied binnen een land (een Spaanse provincie): heeft waarneming.nl regiolijsten op dat niveau, en is dat nuttig?
- Hoe lang duurt de download van een lijst (20–30 kB gecomprimeerd) met slecht bereik? Waarschijnlijk geen probleem.
- Wil waarneming.nl dat we per kwartaal zo tellen, of is er een betere bron voor aantallen per land?
- Kaart van de landsgrenzen in de app: welke bron, hoe grof mag hij zijn (grens tussen Nederland en België)?
- Aantallen over alle jaren (nu) of de laatste tien jaar (`date_after`)? Alle jaren is stabieler; tien jaar volgt verschuivingen. Eerst alle jaren.
