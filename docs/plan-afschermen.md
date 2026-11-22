# Plan: afschermen en embargo met de stem

Voorstel van 22 nov 2026. Komt uit feedback van een tester (app-b726a027, 20 nov): "ik zou graag soorten willen kunnen afschermen met de spraak". Diezelfde tester probeerde het ook in het veld, en de app negeerde het alle drie keer (twee keer trillen, "niet begrepen"):

- "Maak alle vorige meldingen afgeschermd."
- "Zet alle drie de waarnemingen op afgeschermd."
- "Ik wil dat mijn waarnemingen onder embargo worden geplaatst."

Bij waarneming.nl kun je een waarneming vervagen of verbergen (bijvoorbeeld een nest of een slaapplaats van een kwetsbare soort) en hem onder embargo zetten (pas later zichtbaar). De bulkimport heeft daar kolommen voor, `obscurity` en `embargo date`, die de app nu leeg laat (`docs/waarneming-nl.md`).

## Wat we weten

Uit `https://waarneming.nl/api/v1/lookups/` (openbaar, 22 nov nagekeken), lijst `obscurity`:

| ID | Naam (API) | Betekenis |
| --- | --- | --- |
| 0 | public | openbaar (standaard) |
| 1 | obscured (1km) | plek vervaagd tot 1 km |
| 5 | obscured (5km) | plek vervaagd tot 5 km |
| 9 | hidden | verborgen |

Uit het voorbeeldbestand van de bulkimport (`/import/observations/example/`, ingelogd opgehaald op 22 nov):

- **`obscurity` gaat op het getal**, niet op tekst: in de voorbeeldregel staat `0`. Er is geen opzoektabel voor, dus de ID's hierboven. (Anders dan `activity`, `method` e.d., die op Nederlandse tekst gaan.)
- **`embargo date` gaat als `YYYY-mm-dd`** (voorbeeld `2026-11-18`, dezelfde opmaak als `date`).
- De kolommen staan achteraan, na `external reference`; de volgorde maakt niet uit.

Nog niet bekend (de API-documentatie zit achter een botcheck):

1. Of er een maximum is voor de embargodatum.
2. Of waarneming.nl kwetsbare soorten **zelf al vervaagt**. Zo ja, dan hoeft de gebruiker dat voor die soorten niet te zeggen, en kan de uitleg dat vermelden.

Na het bouwen een proefimport met één afgeschermde waarneming en één met embargo.

## Voorstel

### Datamodel

`Observation` krijgt twee optionele velden (geen nieuw Dexie-schema nodig, want ze worden niet geïndexeerd):

- `obscurity?: 0 | 1 | 5 | 9`: het waarneming.nl-ID, net als soort en gedrag. Leeg = openbaar.
- `embargoUntil?: string`: datum `YYYY-mm-dd`.

Ook in `checkImport` (`src/lib/export.ts`) en in de back-up.

### Inspreken

`update_observation` en `add_observation` krijgen de velden `obscurity` en `embargo_until`; het model geeft ze alleen als het gezegd wordt. Voorbeelden voor de prompt (NL en EN, `prompt.ts` en `promptEn.ts`, met een nieuwe promptversie):

- "die afschermen", "de laatste verbergen" → `obscurity` 9
- "vervagen", "op een kilometer vervagen" → 1; "op vijf kilometer" → 5
- "alle vorige afgeschermd" → een `update_observation` per waarneming in de context (zoals "maak van alle voorgaande twee vogels" nu al gaat)
- "een draaihals, nest, afschermen" → `add_observation` met `obscurity` 9
- "onder embargo", "embargo tot volgende maand" → `embargo_until`; zonder datum onzeker, de gebruiker zet de datum thuis

De app controleert de waarden zoals bij de andere ID's (`validate`): een onbekende waarde valt weg, met een regel in de waarschuwingen.

### Op het scherm

- In de lijst een klein slotje bij een afgeschermde waarneming, en "embargo tot …" waar dat geldt (opmaak in `format.ts`, teksten in het woordenboek).
- In de bewerker een keuzelijst "Zichtbaarheid op waarneming.nl" (openbaar, vervaagd 1 km, vervaagd 5 km, verborgen) en een datumveld voor embargo.
- De gesproken bevestiging zegt "afgeschermd" erbij.

### Export

- waarneming.nl (CSV en xlsx, `waarnemingExport.ts`): de kolom `obscurity` met het getal (leeg of `0` bij openbaar), `embargo date` als `YYYY-mm-dd`; in de xlsx als tekstcel zoals de datum, `obscurity` als getal zoals `number`.
- eBird: geen kolom voor afschermen per waarneming. Een afgeschermde waarneming gaat daar dus niet heen; de samenvatting van de export meldt hoeveel.

### Testset en tests

- Testset: de drie uitspraken van de tester hierboven, plus "een draaihals, nest, afschermen" en "die op vijf kilometer vervagen".
- Tests: validatie van het model, export (kolommen gevuld, leeg bij openbaar), `checkImport`.

### Uitleg en privacy

- `HowItWorks.svelte` en `.en.svelte`: één zin met een voorbeeld.
- Changelog.
- Privacy: niets nieuws (er gaan geen gegevens een nieuwe kant op).

## Besloten (22 nov)

1. **"Afschermen" zonder meer erbij** = verborgen (9). "Vervagen" = 1 km, "op vijf kilometer" = 5.
2. **Embargo zonder datum**: onzeker; de gebruiker zet de datum thuis.
3. **eBird**: een afgeschermde waarneming gaat niet naar eBird, met een regel in de samenvatting van de export.
4. **Hele sessie**: eerst alleen per waarneming ("alle vorige" via losse updates); een sessieveld pas als het gevraagd wordt.
5. **Meteen voor iedereen**, geen ontwikkeloptie: de testers proberen het.

## Stappen

1. ~~Eigenaar: beslissen~~ (22 nov).
2. Datamodel, export, `checkImport` en tests (één PR). De validatie van het model komt met de prompt in stap 3.
3. Prompt NL en EN, testset-gevallen (één PR, met testset-run).
4. Scherm: slotje, bewerker, gesproken bevestiging, uitleg en changelog.
5. Proefimport bij waarneming.nl met een afgeschermde waarneming en een embargo.
