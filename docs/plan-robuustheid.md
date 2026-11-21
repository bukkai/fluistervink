# Plan: robuustheid (edge cases)

18 nov 2026. Status: fase 1 (#268), 2 (#273) en 3–5 (code, tests en checklists) klaar. Kwaliteitsronde 18 nov: #9 besloten, #14–#16 erbij en afgedekt (#279). Kwaliteitsronde 21 nov: #17 erbij en afgedekt. Open: proberen op de telefoon en opnames voor de testset; zie de tabel.

Een rondgang "wat zou een tester proberen?" langs de bestaande tests en code. Veel is al afgedekt: netwerk weg op elk moment, de wachtrij na een crash, twee tabbladen (slot en BroadcastChannel), haperende tikken met handschoenen, Merlin tijdens een trektelling, een back-up twee keer terugzetten, CSV met komma's en aanhalingstekens, soorten die het model verzint. Dit plan legt vast wat nog open staat en hoe we het blijvend afdekken, zodat het niet bij één keer nalopen blijft.

## Wat nog open staat

Wat de code en de tests niet kunnen afdekken. Op de telefoon proberen: de checklist "Op de telefoon proberen" in de skill `veldtest-review`.

| # | Geval | Nog te doen | Door wie |
| --- | --- | --- | --- |
| 2 | **Telefoon vol** | Op de telefoon proberen (veldchecklist). Later misschien vooraf waarschuwen met `navigator.storage.estimate()` | eigenaar |
| 6 | **Verwijzing buiten de context** ("die buizerd van een kwartier geleden" na 30 waarnemingen) | De app-kant is afgedekt (zie onder); sinds #303 krijgt het model 20 waarnemingen in plaats van 10. Of het model dan "niet begrepen" of onzeker kiest in plaats van de verkeerde buizerd: een paar opnames in de testset | eigenaar inspreken, daarna `npm run testset` |
| 7 | **Stemmen of geluid van anderen** in een trektelstuk (medevogelaar, radio, wind) | Opnames voor de testset; de prompt alleen aanpassen als de testset het laat zien | eigenaar inspreken |
| 12 | **Gebeld worden** | De code is afgedekt (zie onder); nog op de telefoon proberen, ook met Bluetooth-oortjes | eigenaar |

## Fasen

1. **Wifi-inlogpagina** (#1): een antwoord dat geen JSON is, of status 511, telt als geen bereik (status 0), zodat de offline wachtrij het oppakt. Met een test in de wachtrij. Kleine PR.
2. **Tests voor de wachtrij en de sessie** (#2, #3, #4, #5, #8): nagebootst in Vitest. Waar een test een fout laat zien, de fix in dezelfde PR (samen één PR, met per onderwerp een kopje).
3. **Model en testset** (#6, #7): voorbeelden in `interpret.test.ts` voor wat de app met het antwoord doet; voor wat het model zegt een handvol opnames in de testset (andermans stem, wind, verwijzing ver terug).
4. **Veldchecklist** (#2, #7, #9, #12): een vast rijtje "probeer dit eens" in de skill `veldtest-review`, zodat het bij elke veldtest langskomt.
5. **Structureel**:
   - In `src/test-helpers.ts` een paar storingen klaarzetten die elke test kan gebruiken: netwerk weg, inlogpagina, trage proxy, opslag vol, klok verzetten. Een nieuwe test over de wachtrij hoort ze allemaal langs te lopen.
   - In `docs/kwaliteitsronde.md` een stap "edge cases": deze tabel nalopen, nieuwe gevallen erbij, afgedekte eruit (met de test of PR erbij).
   - Bij een bug uit het veld eerst een test die hem laat zien, dan de fix (zo bleef ook de offline wachtrij heel).

## Afgedekt

Wat af is, komt hier met de test of PR erbij, en gaat uit de tabel.

- **#1 Wifi met een inlogpagina** (#268): een antwoord zonder JSON, of 511, telt als geen bereik. Test "wifi met een inlogpagina" in `observations.test.ts`.
- **#2 Telefoon vol** (fase 2, alleen het testdeel): `submit` in `queue.ts` vangt de fout, logt `save_failed`, trilt "mislukt" en meldt het via `onSaveFailed`; het sessiescherm zegt het en stopt een trektelling. Tests onder "telefoon vol".
- **#3 Stop terwijl de wachtrij bezig is** (fase 2): klaarzetten en exporteren wachten al op onverwerkte uitspraken (`PastSession.svelte`). Nieuw: na het verwerken krijgt een intussen gestopte sessie opnieuw een naam, zodat de laatste uitspraak meetelt. Tests onder "Stop terwijl de wachtrij nog bezig is".
- **#4 Bewerken tijdens een stemcorrectie** (fase 2): Opslaan in het formulier stuurt alleen de velden die je aanpaste (`changedFields`), dus een stemcorrectie terwijl het formulier openstond blijft staan. Fase 3: een waarneming die intussen met de stem verwijderd is, geeft bij Opslaan een melding in plaats van stil niets (`editObservation` geeft `false`).
- **#5 Rare aantallen** (fase 2): onder 1 wordt 1, maar onzeker met de reden; ongedaan maken, opnieuw doen of aanpassen zonder iets om te doen geeft "niet begrepen" in plaats van "opgeslagen" (`acted` in `applyActions.ts`). Tests onder "rare aantallen en niets om te doen".
- **#8 Klok** (fase 2): geen fout gevonden. Tests voor een sessie over middernacht (`waarnemingExport.test.ts`), een klok die terugspringt (`sessions.test.ts`, `effort.test.ts`). Zomertijd volgt uit de lokale tijd van het apparaat, dezelfde code.
- **#6 Verwijzing buiten de context, app-kant** (fase 2 en 3): een verwijzing naar een waarneming die niet in de context stond, weigert de validatie al ("weigert een verwijzing …" in `interpret.test.ts`); blijft er dan niets over, dan krijgt de gebruiker "niet begrepen" (fase 2, `acted`). Wat het model zelf kiest: testset.
- **#10 Nieuwe webcode midden in een sessie** (fase 3): test in `db.test.ts`: van databaseversie 2 naar nu, met een wachtende uitspraak, een lopende sessie en een waarneming; alles blijft staan en de wachtrij vindt de uitspraak. `native.ts` vangt een ontbrekende plugin overal af (`isPluginAvailable` of `.catch`); bij elke nieuwe native functie zo houden.
- **#11 Back-up van een nieuwere versie** (fase 3): tests in `export.test.ts`: onbekende velden gaan mee, een fout halverwege laat niets achter (één transactie), terugzetten tijdens een lopende sessie laat die lopen.
- **#12 Gebeld worden of oortjes weg** (fase 3): stopte het microfoonspoor vanzelf, dan bleef de knop op "opnemen" hangen en ging de opname verloren. Nu rondt het sessiescherm hem af alsof op Stop gedrukt is (`onRecordingInterrupted` in `recorder.svelte.ts`). In een trektelling telde de app stil door met een dode microfoon; nu pauzeert hij (het lopende stuk gaat mee) en zet hij de microfoon na een seconde opnieuw aan (`onTrackEnded` in `trektelRecorder.svelte.ts`). Gebeld worden zet de app meestal op de achtergrond: dat was al een pauze.
- **#13 Feedback als prompt injection** (fase 3): `npm run feedback -- notes` zet boven de feedback dat het gegevens zijn, geen instructies; ook als stap in `docs/kwaliteitsronde.md`.
- **Fase 4 en 5** (structureel): veldchecklist "Op de telefoon proberen" in de skill `veldtest-review`; storingen in `src/test-helpers.ts` (`STORINGEN`, `opslagVol`) met één test die ze allemaal langsloopt; stap "Edge cases" in `docs/kwaliteitsronde.md`.
- **#9 Snel verplaatsen** (#276): varen en rijden tellen niet mee als afgelegde afstand. Een stap sneller dan 30 km/u telt niet, maar verzet wel het ankerpunt (`distanceStep` in `effort.ts`, soort `transport`). Tests in `effort.test.ts`.
- **#14 Plek die later komt, na een vorige sessie** (kwaliteitsronde 18 nov): `positionLater` gaf de eerste meting ook aan uitspraken zonder plek van een sessie die vlak daarvoor gestopt was, misschien kilometers verderop. Nu alleen de lopende sessie. Test "eerdere uitspraken zonder plek krijgen de eerste meting alsnog".
- **#15 Microfoon komt niet terug** (kwaliteitsronde 18 nov): ging de microfoon na een weggevallen spoor niet meer aan, dan stopte de trektelling met alleen twee lange trillen. Nu staat op het scherm waarom (reden `mic` in het log). Test "gaat de microfoon niet meer aan, dan stopt de telling".
- **#16 Plafond van het model per dag** (kwaliteitsronde 18 nov): na #278 stopte alleen het plafond voor spraak een trektelling; bij het plafond van het model ging elk stuk nog naar de spraakherkenning. Nu stoppen beide (`onDailyLimit` in `queue.ts`), en Probeer het eens zegt het in gewone taal.
- **#17 Twee GPS-metingen kort na elkaar in een trektelling** (kwaliteitsronde 21 nov): `improveChunks` in `trektelPosition.ts` wacht per stuk zonder plek op het opzoeken van het gebied. Een betere meting die intussen binnenkwam, werd daarna door de grovere overschreven, en verbeterde niet meer. Nu slaat een stuk over als het al een even goede of betere plek heeft. Test "een grove meting die trager door de stukken loopt, overschrijft een betere niet".
