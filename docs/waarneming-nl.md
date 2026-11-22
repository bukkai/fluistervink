# Onderzoek: waarneming.nl-import, soortenlijst en codes

Stand van zaken 6 oktober 2026.

## 1. Importformaat: bulkimport

Uitgezocht op 10 oktober 2026 (ingelogd). Waarneming.nl heeft een eigen **bulkimport**: `https://waarneming.nl/import/observations/` (het oude adres `/exports/import/` verwijst ernaartoe). Daarnaast zet dezelfde pagina exports van Ornitho, iNaturalist en eBird om; het eBird-formaat hebben we dus niet nodig.

- `.csv` (UTF-8) of `.xlsx`, tot 5000 waarnemingen. Volgorde van de kolommen maakt niet uit; onbekende kolommen worden genegeerd.
  - Het uploadveld accepteert alleen de types `text/csv` en xlsx (niet de extensie `.csv`; nagekeken 15 okt). Op Android krijgt een `.csv` buiten de downloads van Chrome een ander type en is hij uitgegrijsd; daarom exporteert de Android-app xlsx. Het voorbeeldbestand (`observations-import-example.xlsx`, gemaakt met openpyxl) zet datum, tijd en tekst als tekstcel en `lat`, `lng`, `accuracy`, `number` als getal; `src/lib/xlsx.ts` doet hetzelfde.
- De import draait op de achtergrond; je krijgt een e-mail. Bij een fout wordt er níets geïmporteerd en krijg je het bestand terug met een kolom `errors`.
- Voorbeeldbestand met alle kolommen en opzoektabellen: `/import/observations/example/`.

| Kolom | Verplicht | Inhoud | Fluistervink |
|---|---|---|---|
| `date` | ✔ | `YYYY-mm-dd` | lokale datum |
| `time` | | `HH:mm` | lokale tijd |
| `scientific name` | ✔ | wetenschappelijke naam (hoofdletterongevoelig) | uit `data/soorten-nl.json` |
| `lat`, `lng` | ✔ | WGS84 | positie (6 decimalen) |
| `accuracy` | | meters, t/m 1000; 999 = onbekend | GPS-nauwkeurigheid; boven 1000 → 999 |
| `number` | | aantal | `count` |
| `notes` | | vrije tekst | opmerking (niet de eigen notitie en niet de twijfelreden van het model; de twijfel zelf gaat via de zekerheid) |
| `sex` | | `U`, `F`, `M` | `sex` |
| `is certain` | | `True`/`False` | omgekeerde van `uncertain` |
| `is escape` | | `True`/`False` | – |
| `activity`, `life stage`, `method`, `counting method` | | **tekst in de taal van de site** ("overvliegend", "gezien en gehoord", "exact aantal") | Nederlandse naam van het ID |
| `uuid` | | UUIDv4/v7; een uuid die al bestaat → import geweigerd | ID van de waarneming |
| `obscurity` | | **alleen 0 of 1** (proefimport 22 nov: "moet een keuze zijn uit 0, 1"), ook al kent de API 0, 1 (1 km), 5 (5 km) en 9 (verborgen) (`/api/v1/lookups/`) | `obscurity`: elke afscherming als 1, leeg = openbaar; bij 5 of 9 een melding om het op de site strenger te zetten (afgeschermd gaat niet naar eBird, `docs/plan-afschermen.md`) |
| `embargo date` | | `YYYY-mm-dd`; tot die datum is de waarneming helemaal verborgen (proefimport 22 nov). Een nest krijgt van de site zelf een embargo van een half jaar | `embargoUntil` |
| `related species`, `external reference`, `id` | | – | – |

Gevolgen:

- Gedrag, methode, kleed en telmethode komen netjes in de juiste velden, niet meer als tekst in een opmerking.
- Die velden gaan op tekst, niet op ID, en in de taal waarop de site staat. De app exporteert Nederlands (`name` in `data/attributen-vogels.json`; telmethode staat in `vocab.ts`, namen uit `/api/v1/lookups/`), de standaardtaal van waarneming.nl. Tot 6 nov exporteerde de app Engels en moest de site op Engels; een tester liep daarop vast ("seen" niet herkend), dus nu Nederlands. Staat de site op een andere taal, dan worden deze velden niet herkend.
- Dankzij `uuid` kan dezelfde waarneming niet twee keer worden ingevoerd: de hele import wordt dan geweigerd.
- Waarnemingen zonder positie kunnen niet mee (`lat`/`lng` verplicht).
- `Location`/gebied is geen kolom: waarneming.nl bepaalt het gebied zelf uit de coördinaten.
- Geen inspanning: de bulkimport heeft geen kolommen voor duur, afstand, waarnemers of een volledige lijst (nagegaan 11 nov 2026, `docs/plan-ebird.md`). Elke regel is een losse waarneming. Of de API iets als een telling of lijst kent, nagaan bij de aanvraag van een client-ID.
- Nog na te gaan bij de eerste echte import: of verzamelsoorten als `Anatinae indet.` ("Eend onbekend") worden herkend.

### observation.org

Nagegaan op 18 nov 2026. observation.org is geen ander platform maar dezelfde database onder een andere naam (Observation International; ook waarnemingen.be). Bewijs: `/api/v1/observations/300000000/` (een waarneming in Kroatië) en `/api/v1/species/2/` geven op beide domeinen precies hetzelfde terug, en de importpagina staat op hetzelfde adres (`/import/observations/`). De HTML-pagina's zitten achter een botcheck (Anubis), dus het voorbeeldbestand van observation.org zelf is niet bekeken; de API niet.

Gevolgen:

- Een import bij waarneming.nl staat meteen ook op observation.org, ook buiten Nederland (waarneming.nl neemt waarnemingen van overal aan). Voor een Nederlandse gebruiker is "export naar observation.org" er dus al.
- Wat wél verschilt, is de taal van de site: observation.org staat meestal op Engels, en `activity`, `life stage`, `method` en `counting method` gaan op tekst in die taal (zie hierboven). Exporteren voor een Engelstalige gebruiker vraagt dus alleen een keuze voor de taal van die kolommen; de Engelse namen staan al in `data/attributen-vogels.json` (`en`). Dat hoort bij de app in het Engels (`docs/roadmap.md`, punt 8).
- Nog na te gaan, ingelogd: of het voorbeeldbestand van observation.org dezelfde kolommen heeft (vrijwel zeker), en of de import naast tekst ook ID's aanneemt (dan valt het taalprobleem helemaal weg).

## 2. Soortenlijst

Bron: de openbare API van waarneming.nl, zonder sleutel.

- `GET /api/v1/region-lists/5001/species/` geeft alle vogels van de Nederlandse lijst (regio 200 × soortgroep 1): 1610 items, inclusief ondersoorten, hybriden en exoten. Per soort: waarneming.nl-ID, Nederlandse naam, wetenschappelijke naam, zeldzaamheid, inheems ja/nee.
- `scripts/fetch-species.mjs` maakt hiervan [`data/soorten-nl.json`](../data/soorten-nl.json): inheemse soorten van algemeen t/m zeldzaam, verzamelsoorten ("Noordse Stern of Visdief", "Kwikstaart onbekend") en een handvol gevestigde exoten en gedomesticeerde vormen (Nijlgans, Halsbandparkiet, Stadsduif, Parkgans, …). Resultaat: **350 soorten, ongeveer 2000 tokens** als `id|naam`-lijst. Dat past ruim in de systeemprompt.
- Voor het bewerkformulier schrijft het script ook [`data/soorten-nl-alle.json`](../data/soorten-nl-alle.json): alle ±1080 Nederlandse soorten, ook zeer zeldzame dwaalgasten (Dwergaalscholver, Notenkraker), zonder ondersoorten en hybriden. Die lijst krijgt het model niet: noemt de gebruiker een soort die niet in de prompt staat, dan kiest het model de verzamelsoort met "onzeker" en de gezegde naam in de twijfelreden, en zet de gebruiker de soort thuis goed.
- De wetenschappelijke namen volgen waarneming.nl (AviList-taxonomie), dus ze matchen bij de CSV-import. Waarneming.nl past de taxonomie soms aan (nov 2026: Winterkoning *Nannus troglodytes*, Rietgors *Schoeniclus schoeniclus*, Bonte Kraai een ondersoort *Corvus corone cornix*, door de import geaccepteerd op 22 nov); daarom haalt `.github/workflows/soortenlijst.yml` de lijst elke maandag opnieuw op en opent een PR met wat er veranderd is.
- Alternatieve namen ("soepgans" voor Parkgans, "bonte specht" voor Grote Bonte Specht) zitten niet in de bron. Die vullen we zelf aan als we ze in de testset tegenkomen.

Andere soortgroepen (13 nov, `docs/plan-soortgroepen.md`): het script haalt ook zoogdieren (regiolijst 5002), reptielen en amfibieën (5003), dagvlinders (5004) en libellen (5005) op, met hetzelfde filter en een eigen lijst gevestigde exoten. Elke soort heeft een veld `group`; soort-ID's overlappen niet tussen groepen. Gedrag, methode en kleed hebben per groep eigen ID's: `data/attributen-<groep>.json`, met de korte lijsten en standaarden per groep in `src/lib/vocab.ts`.

Engelse namen (19 nov, `docs/plan-engels.md`, stap 2): dezelfde aanroepen met `Accept-Language: en` geven de namen in het Engels ("Mute Swan" voor 136; gedrag "present", "flying over"; telmethode "estimated" uit `/api/v1/lookups/`). Het script zet ze in [`data/namen-en.json`](../data/namen-en.json): per soort-ID de naam, per groep de namen van gedrag, methode en kleed, en de telmethodes. Los van de soortenlijst, zodat er later een taal bij kan zonder de lijst te herhalen (`docs/plan-andere-landen.md`, keuze 1). Heeft een soort geen Engelse naam (veel verzamelsoorten, zoals "Accipiter spec."), dan geeft de bron de wetenschappelijke naam; die laat het script weg en de app valt erop terug. Opvragen met `speciesNameIn('en', id)`, `activityNameIn`, `methodNameIn`, `lifeStageNameIn` en `countingMethodNameIn` in `src/lib/vocab.ts`; nog nergens op het scherm gebruikt.

eBird-namen: het script haalt ook de taxonomie van eBird op (`https://api.ebird.org/v2/ref/taxonomy/ebird`, openbaar, zonder sleutel) en zet per vogel-ID de eBird-naam in [`data/ebird-namen.json`](../data/ebird-namen.json) ("Northern Lapwing", "duck sp."). Koppelen op wetenschappelijke naam (met "spec." als "sp.", gedomesticeerde vormen als "(Domestic type)" en dubbele soorten op volgorde), anders op de Engelse naam van waarneming.nl als precies één eBird-soort zo heet (Winterkoning: *Nannus* bij waarneming.nl, *Troglodytes* bij eBird), en een handvol uitzonderingen met de hand (`EBIRD_EXCEPTIONS`: Stadsduif, "Eend onbekend", …). Alle soorten met zeldzaamheid 1–3 zijn gekoppeld. De eBird-export vult er de kolom "Common Name" mee.

Opnieuw ophalen:

```bash
node scripts/fetch-species.mjs
```

## 3. Codes voor gedrag, methode en kleed

`GET /api/v1/species-groups/1/attributes/` → [`data/attributen-vogels.json`](../data/attributen-vogels.json). De ID's zijn wat de API later verwacht. De belangrijkste:

| Veld | Codes |
|---|---|
| Activiteit | 1 ter plaatse (standaard), 3 roepend, 4 baltsend / zingend, 2 foeragerend, 6 overvliegend (7–14: met windrichting), 25 alarmerend, 30 jagend, 77 rustend, 31 opvliegend |
| Methode | 48 gezien, 49 gehoord, 51 gezien en gehoord, 47 onbekend |
| Kleed/leeftijd | 2 adult, 5 juveniel, 3 adult zomerkleed, 4 adult winterkleed, 14 eerste kalenderjaar, … |
| Telmethode | 2 exact aantal, 6 schatting, 3 gezien niet geteld |

Geslacht staat niet in deze lijst. In de API is het een vaste keuze: man, vrouw of onbekend.

## 4. Voorstel: gesproken termen → velden

| Gezegd | Activiteit | Methode |
|---|---|---|
| "overvliegend", "over", "trekkend" | 6 overvliegend | 48 gezien |
| "overvliegend naar het zuiden" | 12 overvliegend zuid | 48 gezien |
| "roepje", "roept", "roepend" | 3 roepend | 49 gehoord |
| "zingend", "zang", "zingt" | 4 baltsend / zingend | 49 gehoord |
| "alarmerend", "alarm" | 25 alarmerend | 49 gehoord |
| "foeragerend", "zoekt voedsel" | 2 foeragerend | 48 gezien |
| niets genoemd | 1 ter plaatse | 48 gezien |

Telmethode: een getal → exact aantal. "Ongeveer", "zo'n", "een stuk of" → schatting. "Groep" of "zwerm" zonder getal → gezien niet geteld, aantal 1, `uncertain`.
