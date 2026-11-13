# Plan: andere soortgroepen (zoogdieren, dagvlinders, libellen)

Voorstel van 13 nov 2026, nog niet goedgekeurd. Aanleiding: het idee van 12 nov in `docs/ideeen.md`. Een vogelaar die een ree, een vos of een atalanta ziet, wil die ook kwijt, en waarneming.nl neemt ze in dezelfde import.

## Doel

Tijdens een sessie kun je ook zoogdieren, dagvlinders en libellen inspreken ("twee reeën in het weiland", "een atalanta", "drie bloedrode heidelibellen"). Ze krijgen de juiste soort, het juiste gedrag en het juiste kleed volgens waarneming.nl en gaan mee in dezelfde export.

## Wat er al is uitgezocht (13 nov, openbare API van waarneming.nl)

- **Soortenlijsten:** `/api/v1/region-lists/500<groep>/species/`, dezelfde vorm als de vogellijst (5001). Groepen: 2 zoogdieren, 4 dagvlinders, 5 libellen (3 reptielen en amfibieën). Met hetzelfde filter als bij vogels (soort of verzamelsoort, inheems, algemeen t/m zeldzaam):

  | Groep | In de bron | In de prompt | Ongeveer tekens |
  |---|---|---|---|
  | Zoogdieren | 255 | 88 + een handvol gevestigde exoten | 3.600 |
  | Dagvlinders | 178 | 61 | 2.400 |
  | Libellen | 104 | 73 | 3.100 |
  | (Reptielen en amfibieën) | 129 | 27 | 1.100 |

  Samen ruim 9.000 tekens bij de bestaande vogellijst: de systeemprompt wordt ongeveer een kwart groter. Hij blijft gecachet, dus per uitspraak scheelt dat weinig in tijd en kosten.
- **Soort-ID's** overlappen niet met die van vogels, en geen enkele naam komt in twee groepen voor. `getSpecies(id)` blijft dus gewoon werken.
- **Exoten:** net als bij vogels staan er veel ontsnapte dieren als "algemeen" in de bron (Kinkajoe, Huiscavia, Thaise Eekhoorn). Dus ook hier een vaste lijst gevestigde exoten: Damhert, Muskusrat, Beverrat, Gewone Wasbeer, Amerikaanse Nerts, Sikahert, Chinese Muntjak (na te lopen).
- **Gedrag, methode en kleed verschillen per groep, met eigen ID's.** "Ter plaatse" is 1 bij vogels, 15 bij zoogdieren, 20 bij dagvlinders en 45 bij libellen. Daarnaast heeft elke groep eigen codes: "in copula", "eileggend" en "tandem" bij libellen, "rups" en "pop" bij vlinders, "prenten", "uitwerpselen" en "batdetector" bij zoogdieren. Dit is het grootste stuk werk: overal waar de app nu `allActivities` gebruikt, moet hij weten bij welke groep de soort hoort.
- **De import** gaat op wetenschappelijke naam en op de tekst van gedrag, methode en kleed. Dat zou voor elke groep moeten werken, maar het is nog niet getest met iets anders dan vogels.

## De aanpak

### 1. Gegevens

- `scripts/fetch-species.mjs` haalt per groep de soortenlijst en de attributen op (een vaste tabel met groep, regiolijst, exoten en extra ID's per groep).
- Elke soort krijgt een veld `group` (1 vogels, 2 zoogdieren, 4 dagvlinders, 5 libellen). De bestaande bestanden `data/soorten-nl.json` en `data/soorten-nl-alle.json` krijgen de andere groepen erbij, zodat de wekelijkse PR van `soortenlijst.yml` alles tegelijk bijhoudt.
- De attributen komen per groep in een eigen bestand: `data/attributen-zoogdieren.json`, `data/attributen-dagvlinders.json`, `data/attributen-libellen.json`, naast `data/attributen-vogels.json`.
- Bijnamen voor de lange officiële namen in `data/bijnamen.json`: "eekhoorn" → Europese Rode Eekhoorn, "egel" → West-Europese Egel, "haas", "mol", "otter", "bever", "wild zwijn" en "zwijn", "zeehond", "dwergvleermuis" → Gewone Dwergvleermuis, "koolwitje" → Koolwitje onbekend.

### 2. Codes per groep (`src/lib/vocab.ts`)

- `codesFor(groep)` geeft gedrag, methode en kleed van die groep, met per groep een korte lijst voor de prompt (zoals nu `FIELD_ACTIVITIES` voor vogels) en een standaard ("ter plaatse", "gezien").
- `codeName` krijgt de soort mee, zodat de lijst, de context voor het model, het bewerkformulier, het nalopen en de export de goede naam tonen.
- **Van groep wisselen.** Verandert een waarneming van groep (met de stem "nee, een vos", of in het formulier), dan zet de app gedrag, methode en kleed om op naam ("ter plaatse" blijft "ter plaatse", "foeragerend" blijft "foeragerend"). Bestaat de naam in de nieuwe groep niet, dan wordt het de standaard. Hetzelfde geldt bij `copyObservation`.

### 3. Het model (`src/lib/interpret.ts`)

- De soortenlijst in de prompt krijgt per groep een kopje. Er komt een korte sectie "Andere dieren" bij, met per groep de codes uit de korte lijst en de belangrijkste woorden: "in copula", "paring" en "tandem" (libellen), "rups" en "pop" (vlinders), "prenten", "sporen", "uitwerpselen", "batdetector" en "doodgereden" (zoogdieren).
- In het tool-schema worden `activity_id`, `method_id` en `life_stage_id` de vereniging van de korte lijsten van alle groepen. Het aantal optionele velden blijft gelijk, dus de grens van 24 (`MAX_OPTIONAL_PARAMETERS`) komt niet in gevaar.
- **De app valideert per groep.** Geeft het model een code die niet bij de groep van de soort hoort (bijvoorbeeld een vogelcode bij een ree), dan zet de app hem op naam om, anders op de standaard. Dat komt in `warnings`, net als nu bij een verkeerd soort-ID.
- **Namen die op een vogel lijken**, met een vaste regel in de prompt: "koevinkje" (vlinder) is geen vink, "kleine vos" en "grote vos" zijn vlinders en "vos" alleen het zoogdier, en "groentje", "atalanta" en "dagpauwoog" zijn vlinders. Korte zoogdiernamen ("das", "ree", "haas") zijn ook gewone woorden. Is de context onduidelijk, dan wordt de waarneming onzeker in plaats van overgeslagen.
- **Dwaalgasten** (`findVagrant`) blijven voorlopig alleen voor vogels. Een onbekend zoogdier wordt "Zoogdier onbekend" met de gezegde naam in de twijfelreden, net als "Vogel onbekend" nu.
- "Zeldzame soort wordt onzeker" werkt per groep met de zeldzaamheid uit de eigen lijst.

### 4. Spraakherkenning

De STT-prompt krijgt de namen van de andere groepen erbij (ongeveer 220 namen). Dat kan de herkenning van vogelnamen beïnvloeden. Daarom eerst meten met de testset (401 opnames): als de vogelscores dalen, alleen de namen die vaak verkeerd verstaan worden, of helemaal niets. Voor de nieuwe groepen zelf zijn er nog geen opnames. Die moeten we eerst inspreken (de eigenaar, een paar wandelingen).

### 5. Export en de rest van de app

- **waarneming.nl:** geen nieuwe kolommen. De wetenschappelijke naam bepaalt de groep, en gedrag, methode en kleed gaan als tekst van die groep mee. Eén echte import met een zoogdier, een vlinder en een libel is nodig om het na te gaan.
- **eBird** is alleen voor vogels. De eBird-export slaat andere dieren over en meldt dat ("3 waarnemingen van andere dieren niet meegenomen").
- **Bewerkformulier:** de soortkeuze toont de groep bij de naam, en gedrag, methode en kleed tonen de lijst van die groep.
- **Lijst, kaart en samenvatting:** werken op soort-ID en hoeven niet anders. In de samenvatting komen de vogels en de andere dieren apart ("24 soorten vogels, ook 2 zoogdieren en 1 libel").
- **Feedback en testset:** `scripts/testset.mjs` krijgt `--soortgroepen` voor de variant met de andere groepen. De scoring werkt al op soort-ID en code.

### 6. Aan- en uitzetten

- **Fase 1: ontwikkeloptie** `soortgroepen` (`src/lib/devOptions.ts`, standaard uit), met een eigen promptvariant zoals `kandidaten`. Testers merken niets: hun prompt blijft precies gelijk.
- **Fase 2: voor iedereen,** pas als (a) de testset geen achteruitgang bij vogels laat zien, (b) een echte import bij waarneming.nl gelukt is, en (c) een paar wandelingen met andere dieren goed gingen. Dan ook `#uitleg` (een voorbeeld met een ree of een vlinder), de changelog en de Play-vermelding bijwerken, en `CLAUDE.md` ("Nederlandse vogels" wordt "vogels, zoogdieren, dagvlinders en libellen"). `#privacy` hoeft niet: er gaan geen gegevens een nieuwe kant op.

## Fasen

1. **Gegevens en codes per groep** (punt 1 en 2): script, data, `vocab.ts`, omzetten bij een wisseling van groep, met tests. Nog niets zichtbaar.
2. **Model en export** (punt 3 en 5), achter de ontwikkeloptie, met tests voor de validatie per groep en de eBird-export. De testset-vlag erbij.
3. **Meten** (punt 4): testset met en zonder de andere groepen, opnames van de nieuwe groepen, één echte import.
4. **Voor iedereen** (punt 6, fase 2).

Elke fase is een eigen PR.

## Open vragen

- **Reptielen en amfibieën meteen mee?** Het zijn er maar 27 (pad, bruine kikker, ringslang, zandhagedis) en ze komen vaak voor tijdens een wandeling. Het kost bijna niets extra. Voorstel: ja, als vierde groep.
- **Voor iedereen standaard aan, of een keuze bij Instellingen** ("Ook andere dieren inspreken")? Een keuze houdt de prompt kleiner voor wie alleen vogelt. Standaard aan maakt de app breder en is eenvoudiger. Voorstel: standaard aan, met een keuze om het uit te zetten, maar pas beslissen na fase 3.
- **Exoten bij zoogdieren:** welke gevestigde soorten horen erbij? Voorstel hierboven; de huiskat niet.
