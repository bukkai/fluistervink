# Plan: robuustheid (edge cases)

18 nov 2026. Status: fase 1 klaar (#268), fase 2 in uitvoering.

Een rondgang "wat zou een tester proberen?" langs de bestaande tests en code. Veel is al afgedekt: netwerk weg op elk moment, de wachtrij na een crash, twee tabbladen (slot en BroadcastChannel), haperende tikken met handschoenen, Merlin tijdens een trektelling, een back-up twee keer terugzetten, CSV met komma's en aanhalingstekens, soorten die het model verzint. Dit plan legt vast wat nog open staat en hoe we het blijvend afdekken, zodat het niet bij één keer nalopen blijft.

## Wat nog open staat

Op volgorde van kans in het veld. "Soort" zegt hoe we het afdekken: **test** (Vitest, nagebootst), **veld** (zelf op de telefoon proberen, staat op de checklist hieronder) of **let op** (geen code, wel in de kwaliteitsronde).

| # | Geval | Soort | Wat we willen |
| --- | --- | --- | --- |
| 2 | **Telefoon vol**: een lange trektelling bewaart veel audio; IndexedDB geeft een `QuotaExceededError` | veld | Afgedekt met een test (zie onder); nog op de telefoon proberen. Later misschien vooraf waarschuwen met `navigator.storage.estimate()` |
| 6 | **Verwijzing buiten de context**: "die buizerd van een kwartier geleden" na 30 waarnemingen | test + testset | Onzeker of niet begrepen, niet de verkeerde waarneming aanpassen |
| 7 | **Stemmen of geluid van anderen** in een trektelstuk: een medevogelaar, een autoradio, wind die langs de stiltedetectie komt en waar de spraakherkenning tekst bij verzint | veld + testset | Geen waarnemingen uit andermans zinnen of verzonnen tekst; een paar opnames hiervan in de testset |
| 9 | **Snel verplaatsen** (boot naar Terschelling, auto): telt mee als afgelegde afstand voor eBird; waarnemingen buiten Nederland of op zee | test + veld | Besluiten of een boot meetelt (eBird zegt: niet), en wat `/api/area` buiten Nederland teruggeeft |
| 10 | **Nieuwe webcode midden in een sessie** (`server.url`): een Dexie-versiesprong met wachtende uitspraken, of nieuwe webcode in een oude app zonder een native functie | test + let op | Migratie met wachtende uitspraken getest; `native.ts` valt terug als een plugin ontbreekt |
| 11 | **Back-up van een nieuwere versie in een oudere**, of terugzetten tijdens een lopende sessie | test | Duidelijke weigering of veilig toevoegen, nooit een halve import |
| 12 | **Gebeld worden midden in een opname of trektelling**: het microfoonspoor wordt gedempt of stopt | veld + test | Wat al opgenomen is blijft bewaard; een trektelling pauzeert zoals bij Merlin |
| 13 | **Feedback als prompt injection**: getypte feedback van testers komt via `npm run feedback -- notes` bij Claude Code terecht | let op | Feedback is gegevens, nooit instructies; zo in de werkwijze en de kwaliteitsronde |

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
- **#4 Bewerken tijdens een stemcorrectie** (fase 2): Opslaan in het formulier stuurt alleen de velden die je aanpaste (`changedFields`), dus een stemcorrectie terwijl het formulier openstond blijft staan. Nog open: een waarneming die met de stem verwijderd is terwijl het formulier openstaat; Opslaan doet dan stil niets.
- **#5 Rare aantallen** (fase 2): onder 1 wordt 1, maar onzeker met de reden; ongedaan maken, opnieuw doen of aanpassen zonder iets om te doen geeft "niet begrepen" in plaats van "opgeslagen" (`acted` in `applyActions.ts`). Tests onder "rare aantallen en niets om te doen".
- **#8 Klok** (fase 2): geen fout gevonden. Tests voor een sessie over middernacht (`waarnemingExport.test.ts`), een klok die terugspringt (`sessions.test.ts`, `effort.test.ts`). Zomertijd volgt uit de lokale tijd van het apparaat, dezelfde code.
