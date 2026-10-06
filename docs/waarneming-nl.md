# Onderzoek: waarneming.nl-import, soortenlijst en codes

Stand van zaken 6 oktober 2026.

## 1. Importformaat (CSV)

Waarneming.nl heeft geen eigen CSV-importformaat. Wel kan het **eBird-exportformaat** geïmporteerd worden (`https://waarneming.nl/exports/import/` als je bent ingelogd). Volgens de [uitleg op het forum](https://forum.waarneming.nl/index.php?topic=452489.0) is die import ook bedoeld voor gegevens uit andere programma's.

Eisen:

- Precies 23 kolommen, scheidingsteken komma, kolomkoppen in deze volgorde:
  `Submission ID, Common Name, Scientific Name, Taxonomic Order, Count, State/Province, County, Location_id, Location, Latitude, Longitude, Date, Time, Protocol, Duration (Min), All Obs Reported, Distance Traveled (km), Area Covered (ha), Number of Observers, Breeding Code, Observation Details, Species Comments, Checklist Comments`
- Verplicht: `Scientific Name`, `Count`, `Latitude`, `Longitude`, `Date`, `Time`.
- De soort wordt herkend aan de **wetenschappelijke naam**, niet aan een ID.
- `Date` als `mm-dd-yyyy`, `Time` als `hh:mm AM`/`PM` (Amerikaans).
- Coördinaten decimaal (`52.0181171`).
- Maximaal ~5000 waarnemingen per upload. Open het bestand niet in Excel: dat verandert de datum- en tijdnotatie.

**Beperking:** er zijn geen kolommen voor activiteit (overvliegend, zingend), methode (gezien/gehoord), geslacht of kleed. `Breeding Code` accepteert alleen eBird-broedcodes. Dat betekent:

- Bij de CSV-import gaat het gedrag verloren. We kunnen het als tekst in `Species Comments` meegeven ("overvliegend, gehoord"), maar dan moet je het op de site handmatig nog in de juiste velden zetten.
- Alleen met de API (op de roadmap, buiten de MVP) komen activiteit, methode en kleed netjes in de juiste velden.

**Nog te controleren:** of de importpagina naast eBird nog andere formaten aanbiedt. Die pagina is alleen zichtbaar als je bent ingelogd.

## 2. Soortenlijst

Bron: de openbare API van waarneming.nl, zonder sleutel.

- `GET /api/v1/region-lists/5001/species/` geeft alle vogels van de Nederlandse lijst (regio 200 × soortgroep 1): 1610 items, inclusief ondersoorten, hybriden en exoten. Per soort: waarneming.nl-ID, Nederlandse naam, wetenschappelijke naam, zeldzaamheid, inheems ja/nee.
- `scripts/fetch-species.mjs` maakt hiervan [`data/soorten-nl.json`](../data/soorten-nl.json): inheemse soorten van algemeen t/m zeldzaam, verzamelsoorten ("Noordse Stern of Visdief", "Kwikstaart onbekend") en een handvol gevestigde exoten (Nijlgans, Halsbandparkiet, Steenduif, …). Resultaat: **343 soorten, ongeveer 2000 tokens** als `id|naam`-lijst. Dat past ruim in de systeemprompt.
- De wetenschappelijke namen volgen waarneming.nl (AviList-taxonomie), dus ze matchen bij de CSV-import.
- Alternatieve namen ("stadsduif" voor Steenduif, "bonte specht" voor Grote Bonte Specht) zitten niet in de bron. Die vullen we zelf aan als we ze in de testset tegenkomen.

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
