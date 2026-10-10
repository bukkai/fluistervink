# Onderzoek: waarneming.nl-import, soortenlijst en codes

Stand van zaken 6 oktober 2026.

## 1. Importformaat: bulkimport

Uitgezocht op 10 oktober 2026 (ingelogd). Waarneming.nl heeft een eigen **bulkimport**: `https://waarneming.nl/import/observations/` (het oude adres `/exports/import/` verwijst ernaartoe). Daarnaast zet dezelfde pagina exports van Ornitho, iNaturalist en eBird om; het eBird-formaat hebben we dus niet nodig.

- `.csv` (UTF-8) of `.xlsx`, tot 5000 waarnemingen. Volgorde van de kolommen maakt niet uit; onbekende kolommen worden genegeerd.
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
| `activity`, `life stage`, `method`, `counting method` | | **tekst in de taal van de site** ("flying over", "seen and heard", "real count") | Engelse naam van het ID |
| `uuid` | | UUIDv4/v7; een uuid die al bestaat → import geweigerd | ID van de waarneming |
| `related species`, `external reference`, `obscurity`, `embargo date`, `id` | | – | – |

Gevolgen:

- Gedrag, methode, kleed en telmethode komen netjes in de juiste velden, niet meer als tekst in een opmerking.
- Die velden gaan op tekst, niet op ID, en in de taal waarop de site staat. De app exporteert Engels (`en` in `data/attributen-vogels.json`, opgehaald met `Accept-Language: en`; telmethode staat in `vocab.ts`). De site moet bij het importeren dus op Engels staan. De Engelse API-namen zijn gelijk aan die in de opzoektabel van het voorbeeldbestand.
- Dankzij `uuid` kan dezelfde waarneming niet twee keer worden ingevoerd: de hele import wordt dan geweigerd.
- Waarnemingen zonder positie kunnen niet mee (`lat`/`lng` verplicht).
- `Location`/gebied is geen kolom: waarneming.nl bepaalt het gebied zelf uit de coördinaten.
- Nog na te gaan bij de eerste echte import: of verzamelsoorten als `Anatinae indet.` ("Eend onbekend") worden herkend.

## 2. Soortenlijst

Bron: de openbare API van waarneming.nl, zonder sleutel.

- `GET /api/v1/region-lists/5001/species/` geeft alle vogels van de Nederlandse lijst (regio 200 × soortgroep 1): 1610 items, inclusief ondersoorten, hybriden en exoten. Per soort: waarneming.nl-ID, Nederlandse naam, wetenschappelijke naam, zeldzaamheid, inheems ja/nee.
- `scripts/fetch-species.mjs` maakt hiervan [`data/soorten-nl.json`](../data/soorten-nl.json): inheemse soorten van algemeen t/m zeldzaam, verzamelsoorten ("Noordse Stern of Visdief", "Kwikstaart onbekend") en een handvol gevestigde exoten en gedomesticeerde vormen (Nijlgans, Halsbandparkiet, Stadsduif, Parkgans, …). Resultaat: **350 soorten, ongeveer 2000 tokens** als `id|naam`-lijst. Dat past ruim in de systeemprompt.
- Voor het bewerkformulier schrijft het script ook [`data/soorten-nl-alle.json`](../data/soorten-nl-alle.json): alle ±1080 Nederlandse soorten, ook zeer zeldzame dwaalgasten (Dwergaalscholver, Notenkraker), zonder ondersoorten en hybriden. Die lijst krijgt het model niet: noemt de gebruiker een soort die niet in de prompt staat, dan kiest het model de verzamelsoort met "onzeker" en de gezegde naam in de twijfelreden, en zet de gebruiker de soort thuis goed.
- De wetenschappelijke namen volgen waarneming.nl (AviList-taxonomie), dus ze matchen bij de CSV-import.
- Alternatieve namen ("soepgans" voor Parkgans, "bonte specht" voor Grote Bonte Specht) zitten niet in de bron. Die vullen we zelf aan als we ze in de testset tegenkomen.

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
