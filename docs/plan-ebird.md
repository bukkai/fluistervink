# Plan: inspanning vastleggen en export naar eBird

Voorstel van 11 nov 2026, dezelfde dag goedgekeurd (drempels 50 m, onzekere waarnemingen mee met een waarschuwing, de vraag bij het stoppen alleen voor eBird-gebruikers). Fase 1 gebouwd (11 nov). Fase 2 deel 1, het exportbestand, gebouwd op 12 nov (zie Fasen). Dezelfde dag de eerste echte imports bij eBird gelukt. Fase 3 is uitgewerkt in punt 8 (12 nov, dezelfde dag goedgekeurd). Aanleiding: de brainstorm over inspanningsgegevens (nov 2026), en de eigenaar en een paar mensen in zijn omgeving gebruiken eBird.

## Doel

Een sessie in Fluistervink wordt zonder extra werk een volledige eBird-checklist: met duur, afstand, aantal waarnemers en of je alles hebt genoteerd. Dat maakt de waarnemingen veel waardevoller voor onderzoek. Een volledige lijst zegt ook wat je níet zag, en de inspanning laat zien hoe goed je keek.

De inspanning wordt vanaf de eerste fase bewaard, ook bij wie (nog) geen eBird gebruikt. Wat je nu niet vastlegt, kun je later niet meer terughalen.

## Wat niet verandert

- **Geen GPS-track.** De app telt alleen de afgelegde afstand op, zoals een kilometerteller. De posities zelf worden niet bewaard (zie punt 2).
- De export naar waarneming.nl blijft zoals hij is. eBird krijgt een eigen exportknop en een eigen status ("geëxporteerd naar eBird"), los van die van waarneming.nl.
- Geen API, geen account bij eBird nodig in de app: de gebruiker uploadt het bestand zelf bij eBird (Submit → Import data).
- Wie geen eBird gebruikt, merkt niets: geen extra vraag, geen extra knop.

## De aanpak

### 1. Wat de app per sessie bewaart

Een nieuw veld `effort` op `Session` (`src/lib/db.ts`):

- **Duur** (`activeMs`): de tijd dat de sessie liep. Telt op per stuk: wie een sessie stopt en later voortzet (`resumeSession`), krijgt de tussentijd niet mee. Een vergeten sessie die vanzelf stopt (`checkStaleSession`), eindigt al bij de laatste uitspraak; dat blijft zo.
- **Afstand** (`distanceM`): zie punt 2.
- **Aantal waarnemers** (`observers`): standaard 1. De app onthoudt de laatst gekozen waarde, want wie altijd met z'n tweeën vogelt, wil dat niet elke keer invullen.
- **Alles genoteerd?** (`complete`: ja, nee of nog niet gevraagd), zie punt 3.
- **Protocol** (`protocol`): leeg = de app kiest (punt 4); de gebruiker kan het bij het nalopen zelf zetten.

Oude sessies hebben geen `effort`. Daarvoor rekent de app de duur uit begin- en eindtijd uit; de afstand blijft dan leeg.

### 2. Afstand zonder track

- In `src/lib/location.svelte.ts` draait tijdens een sessie al `watchPosition`. Bij elke meting telt de app de afstand tot het vorige **ankerpunt** op als die groter is dan de onnauwkeurigheid van beide metingen (en minstens 20 m). Dan wordt de nieuwe meting het ankerpunt. Metingen met een onnauwkeurigheid boven 50 m slaat hij over. Zo loopt de teller niet op door GPS-ruis terwijl je in een vogelhut zit.
- Het ankerpunt staat tijdelijk bij de lopende sessie (één punt, steeds overschreven), zodat een herstart van de app niet de hele afstand tot dan toe kwijtraakt. Bij het stoppen gaat het weg.
- Staat de app op de achtergrond of het scherm op slot, dan komen er geen metingen. Bij terugkomst telt de app de rechte lijn vanaf het ankerpunt. Dat is een onderschatting, maar eBird vraagt ook om een schatting.
- De afstand wordt bijgewerkt in de database bij elke stap die meetelt (dus hooguit om de 20 m), en een sprong van meer dan 180 km/u telt niet: dat is de GPS, geen verplaatsing.
- De rekenregels (wel of niet optellen, afstand tussen twee punten) komen in een losse functie zonder browser-API's (`src/lib/effort.ts`), met tests.
- CLAUDE.md en `#privacy` aanpassen: de app telt de afstand op, maar bewaart geen route.

### 3. De vraag bij het stoppen

- Alleen voor wie eBird gebruikt (fase 3: de instelling "Ik gebruik eBird"; daarvóór een ontwikkeloptie). Na Stop komt één vraag: **"Heb je alles genoteerd wat je kon herkennen?"** met **Ja** en **Nee**, en daaronder kleiner het aantal waarnemers (− 1 +). Wegtikken mag: dan staat het antwoord op "nog niet gevraagd", en vraagt de app het opnieuw bij de eBird-export.
- Bij het nalopen van de sessie (`src/lib/PastSession.svelte`) een kaartje **eBird** met duur, afstand, waarnemers, alles genoteerd en protocol, allemaal aan te passen. Daar kan ook de afstand verbeterd worden, als de GPS slecht was.
- De uitleg bij de vraag (onder "Wat betekent dit?"): alles noteren betekent niet dat je elke vogel telde, wel dat je geen soort bewust wegliet.

### 4. Van sessie naar checklist

- **Eén sessie = één checklist.** eBird wil per checklist één datum en één plek: de app neemt de plek van de eerste waarneming met een positie (anders die van de start), en als naam die van de sessie (`place.name`). Een sessie over middernacht wordt één checklist op de startdatum, met een waarschuwing.
- **Protocol:** Stationary als de afstand onder 50 m blijft, anders Traveling. Incidental alleen als de gebruiker dat zelf kiest (bv. een losse waarneming uit de tuin, zonder echte inspanning).
- **Eén regel per eBird-soort:** waarnemingen van dezelfde soort worden opgeteld. Is er een zonder aantal, dan wordt het `X` (aanwezig, niet geteld). Gedrag en methode gaan in het commentaar bij de soort ("3 overvliegend; 1 zingend"), zonder komma's (zie punt 6).
- **Wat eruit blijft:** waarnemingen die "niet exporteren" hebben, en waarnemingen zonder soort die eBird kent (zie punt 5). Onzekere waarnemingen gaan mee zoals ze zijn; de exportknop waarschuwt als er nog onzekere zijn, net als bij waarneming.nl.
- **Lange sessies:** eBird raadt aan om Traveling-checklists onder 8 km te houden. Bij een sessie die langer is, waarschuwt de export alleen. Een sessie opsplitsen kan niet goed zonder track, dus dat doet de app niet.
- **Commentaar bij de checklist:** "Ingesproken met Fluistervink", zodat de herkomst duidelijk is.

### 5. Soortnamen van waarneming.nl naar eBird

- eBird gebruikt een eigen indeling (eBird/Clements), die elk jaar verandert. De import herkent een soort aan de Engelse of de wetenschappelijke naam. Wat hij niet herkent, kiest de gebruiker in de stap "Fix Species" bij eBird zelf.
- Nieuw script `scripts/fetch-ebird-taxonomy.mjs`: haalt de taxonomie op via de eBird API (`/v2/ref/taxonomy/ebird?fmt=csv`; misschien is een gratis API-sleutel nodig, dan als geheim in GitHub) en zet per soort-ID van waarneming.nl de eBird-naam in `data/ebird-soorten.json`. Koppelen op wetenschappelijke naam, plus een lijstje uitzonderingen met de hand in `data/ebird-uitzonderingen.json`:
  - verzamelsoorten: "Eend onbekend" → "duck sp.", "Wilde of Kleine Zwaan" → "Whooper/Tundra Swan";
  - verschillen in indeling (soorten die de een splitst en de ander niet);
  - Stadsduif (`Columba livia f. domestica`) → "Rock Pigeon (Feral Pigeon)", zoals eBird het voorschrijft.
- Het script meldt welke soorten niet te koppelen zijn. Doel: alle soorten met zeldzaamheid 1 tot 3 gekoppeld; de rest mag de gebruiker bij eBird zelf kiezen.
- Opnieuw ophalen: mee in de wekelijkse workflow `.github/workflows/soortenlijst.yml`, die bij een wijziging al een PR opent.

### 6. Het bestand

- eBird Record Format (Extended): CSV met komma's, **zonder kopregel en zonder aanhalingstekens**, hooguit 1 MB. Daarom haalt de app komma's, aanhalingstekens en regeleindes uit alle tekst (plaatsnaam, commentaar).
- Datum als maand/dag/jaar, begintijd 24-uurs, duur in minuten, afstand in mijlen (2 decimalen), land `NL`. De provincie (kolom State) laten we eerst leeg: bij de import wijs je de plek toch op een kaart aan. Pas invullen als een echte import zonder provincie mislukt.
- Vóór de bouw de precieze kolomvolgorde controleren tegen de sjabloon van eBird (bijlage A van de importhandleiding) en daar een test van maken.
- Eén of meer sessies in één bestand, net als bij waarneming.nl. Bestandsnaam `ebird-<datum>.csv`.
- In de Android-app eerst testen of het uploadveld van eBird een .csv accepteert. Bij waarneming.nl lukte dat niet (vandaar de xlsx); eBird neemt geen xlsx, dus als het misgaat moet de app het bestand een ander type geven.
- Nieuwe logica in `src/lib/ebirdExport.ts`, naast `waarnemingExport.ts`, met tests voor het optellen, het protocol, de mijlen en het opschonen van tekst.

### 7. Uitleg, privacy en meten

- `#uitleg`: een korte alinea over eBird, de vraag bij het stoppen en het importeren bij eBird.
- `#privacy`: de afstand wordt op de telefoon opgeteld, zonder route. Het bestand voor eBird gaat alleen naar eBird als de gebruiker het daar zelf uploadt.
- De inspanning gaat mee in de JSON-export en het delen met de ontwikkelaar (zit in het sessie-object). Zo is te zien of de afstand redelijk klopt.
- Gebeurtenissenlog: hoe vaak de teller een meting oversloeg wegens onnauwkeurigheid, zodat de drempels bij te stellen zijn.

### 8. Workflow voor wie eBird gebruikt (fase 3)

Voorstel van 12 nov, dezelfde dag goedgekeurd. Aanleiding: de eerste echte imports werkten, en de eigenaar wil een exportknop op het scherm Sessies. Twee eisen: wie geen eBird gebruikt, krijgt geen vraag en geen knop; en de vraag "alles genoteerd?" mag niet pas komen bij een export van een stapel sessies, als je het niet meer weet.

**De instelling**

- "Ik gebruik eBird" bij Instellingen onder "Nalopen en export", standaard uit. Hij vervangt de ontwikkeloptie `ebird` (`src/lib/devOptions.ts`); de eigenaar zet hem daarna zelf aan.
- `src/lib/preferences.ts` kent nu alleen keuzes die standaard aan staan (alleen "uit" wordt bewaard). Deze staat standaard uit, dus `preferenceOn` krijgt per keuze een standaard.
- Alles hieronder bestaat alleen als de instelling aan staat.

**De vraag, op het moment dat je het nog weet**

De vraag komt op drie plekken langs, steeds dezelfde, en elk antwoord geldt overal (`checklist.complete`):

1. **Na Stop** (punt 3, zoals goedgekeurd): één vraag met Ja en Nee, daaronder het aantal waarnemers. Wegtikken mag.
2. **Bij het klaarzetten** (`approveSession`, "Alles klopt"): is de vraag nog open, dan komt hij daar nog één keer. Wegtikken mag weer. Het eBird-kaartje bij het nalopen (`src/lib/EbirdEffort.svelte`) blijft de plek om alles aan te passen.
3. **Op het scherm Sessies**, als vangnet: zie hieronder.

Geen standaardantwoord ("ik noteer meestal alles"). eBird leidt uit dat veld af welke soorten er niet waren; een automatisch "ja" maakt de gegevens ongemerkt onjuist.

**Het scherm Sessies** (`src/lib/PastSessions.svelte`)

- Een tweede knop onder die van waarneming.nl: **"Exporteren voor eBird (3 sessies)"**. Hij neemt alle sessies die klaarstaan of al naar waarneming.nl zijn geëxporteerd en nog geen `ebirdExportedAt` hebben. Eén bestand; `buildEbirdExport` kan dat al.
- Sessies waar de vraag nog open is, staan boven de knop als korte lijst: datum, gebied, en **Ja** / **Nee**. Eén tik per sessie. Zolang er een open is, is de knop uit, met de regel "Beantwoord eerst de vraag bij 2 sessies".
- Waarnemers en soort telling vraagt de lijst niet: de app kiest die al (laatst gekozen aantal, protocol uit de afstand), en ze zijn aan te passen in de sessie zelf.
- De waarschuwingen (langer dan 8 km, over middernacht, onzekere waarnemingen) komen samen in één bevestiging, met de naam van de sessie ervoor. Dat doet `exportForEbird` al.
- Onder de knop de uitleg over "eBird Record Format (Extended)", zoals bij de losse export.
- De keuze welke sessies meegaan komt als losse functie in `src/lib/ebirdExport.ts`, met tests.

**Status per doel**

- "Klaar" blijft één status voor beide. "Geëxporteerd" wordt per doel bijgehouden; dat doet de code al (`exportedAt` en `ebirdExportedAt`).
- In de lijst met sessies ziet een eBird-gebruiker per sessie waar hij heen is: "waarneming.nl" en "eBird", elk met een vinkje. Wie geen eBird gebruikt, ziet wat hij nu ziet.
- De herinnering aan de export (`src/lib/exportReminder.ts`) blijft alleen over waarneming.nl gaan.

**Ook in deze fase** (punt 7): een alinea in `#uitleg`, `#privacy` (het bestand gaat alleen naar eBird als je het zelf uploadt), een regel in de changelog onder Export.

**Twee PR's:** eerst de instelling met de vraag na Stop en bij het klaarzetten; daarna de knop en de lijst op het scherm Sessies met de status per doel.

**Afwijking bij de bouw (13 nov)**

- Sessies van vóór het aanzetten van "Ik gebruik eBird" doen niet vanzelf mee met de knop op het scherm Sessies, alleen als de vraag "alles genoteerd?" er in de sessie zelf bij beantwoord is. Anders stond na het aanzetten de hele geschiedenis klaar, met per sessie een vraag die je niet meer kunt beantwoorden. De app onthoudt daarvoor sinds wanneer de instelling aan staat (`preferenceSince`).
- "Niet naar eBird" is ook in het eBird-kaartje van de sessie aan en uit te zetten.

**Besloten bij de goedkeuring (12 nov)**

- Een sessie kan "niet naar eBird" krijgen (een lijstje uit de tuin dat je alleen bij waarneming.nl wilt): een derde keuze in de lijst op het scherm Sessies, naast Ja en Nee. Zo'n sessie telt niet meer mee in de eBird-knop.
- De vraag komt na Stop én bij het klaarzetten, zoals hierboven.

## Fasen

1. **Inspanning vastleggen** (punt 1 en 2, plus het eBird-kaartje bij het nalopen, alleen kijken). Voor iedereen, onzichtbaar: de app bewaart duur en afstand. Zichtbaar alleen voor de eigenaar (ontwikkeloptie). Een paar wandelingen en een fietstocht laten zien of de afstand redelijk klopt met wat Strava of Komoot zegt.
2. **Export naar eBird** (punt 3 tot 6), als ontwikkeloptie. De eigenaar importeert een paar eigen sessies echt bij eBird en controleert soorten, plek en inspanning. In twee PR's:
   - **Deel 1, het exportbestand** (12 nov, `src/lib/ebirdExport.ts`): het eBird-kaartje bij het nalopen wordt invulbaar (soort telling, afstand, waarnemers, alles genoteerd) met een knop "Exporteren voor eBird" voor die ene sessie. Afwijkend van punt 1 en 3: de antwoorden staan in een eigen veld `checklist` bij de sessie, niet in `effort` (dat meet de app zelf; zo werkt het ook bij sessies van vóór de inspanning, die zonder afstand standaard Incidental worden). De vraag bij het stoppen komt pas in fase 3; tot dan blokkeert de export zolang "alles genoteerd" niet beantwoord is. Soorten gaan alleen met de wetenschappelijke naam (kolommen Genus en Species); land vast `NL`. Kolomvolgorde nagekeken op 12 nov tegen bijlage A en het voorbeeldbestand van eBird (namen van de 19 kolommen; vastgelegd in een test).
   - **Deel 2, soortnamen van eBird** (punt 5): pas als blijkt hoe vaak "Fix Species" nodig is bij een echte import. Bekende gevallen: verzamelsoorten ("Anatinae indet."), *Nannus troglodytes* (eBird: *Troglodytes troglodytes*), Stadsduif.
   - Echte import (12 nov): twee sessies van de eigenaar geïmporteerd. Bij eBird moet je zelf "eBird Record Format (Extended)" kiezen; met het voorgekozen "Checklist Format (Grid)" mislukt het met "Missing location name detected in first row". De uitleg onder de knop zegt dat nu (#225).
   - Nog te doen na deel 1: noteren welke soorten "Fix Species" nodig hadden, en in de Android-app nagaan of het uploadveld van eBird de .csv neemt. Export van alle sessies tegelijk (scherm Sessies): zie punt 8.
3. **Voor iedereen** (punt 7 en 8; gebouwd op 12 en 13 nov in twee PR's: eerst de instelling met de vraag na Stop en bij het klaarzetten, daarna de knop en de lijst op het scherm Sessies met de status per doel): de instelling "Ik gebruik eBird" bij Instellingen onder "Nalopen en export" (standaard uit), uitleg, privacy, een regel in de changelog. Daarna testers uit de eigen omgeving die eBird gebruiken.

Elke fase is één PR, behalve fase 2 en 3 (elk twee).

## Open vragen voor de eigenaar

- Zijn de drempels goed: Stationary onder 50 m, metingen boven 50 m onnauwkeurigheid overslaan?
- Onzekere waarnemingen: meesturen (zoals nu bij waarneming.nl, met een waarschuwing) of eruit laten?
- Moet de vraag "Alles genoteerd?" later ook voor wie geen eBird gebruikt? Dat maakt de gegevens beter (bijvoorbeeld voor het idee met de kilometerhokken), maar is een extra tik voor iedereen.
- Bewaart de bulkimport van waarneming.nl iets van lijsten of inspanning? Nee (11 nov): de import kent alleen losse waarnemingen, zie `docs/waarneming-nl.md`. eBird blijft dus de enige plek waar de inspanning heen gaat. De API nog nagaan bij de aanvraag van een client-ID.
  - **De API kent wel sessies** (12 nov, uit de client [observation-js](https://github.com/robbeverhelst/observation-js), `src/types/sessions.ts`; niet uit officiële documentatie): `POST /api/v2/sessions/` met begin, eind, notitie en een type `point` (één plek, een Point) of `transect` (een route, een LineString). Per soortgroep twee vragen, elk ja/nee/onbekend: `all_species_counted` (alle soorten genoteerd) en `all_individuals_counted` (alle exemplaren geteld). Een waarneming hoort erbij via `transect_uuid`.
  - Gevolg voor dit plan: het antwoord op "Alles genoteerd?" (punt 3) is later ook bruikbaar voor waarneming.nl, als `all_species_counted` voor de soortgroep vogels. Bewaar het dus niet als iets van eBird alleen. Een vraag "alle exemplaren geteld?" is extra; nuttig bij trektellen, niet nu.
  - Een route hebben we bewust niet (geen GPS-track). Stationary wordt `point`; voor een lopende sessie een `transect` met een lijn door de plekken van de waarnemingen (die bewaren we al), of zonder sessie. Pas beslissen als de API er komt.
