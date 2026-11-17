# Plan: robuustheid (edge cases)

18 nov 2026. Status: fase 1 in uitvoering.

Een rondgang "wat zou een tester proberen?" langs de bestaande tests en code. Veel is al afgedekt: netwerk weg op elk moment, de wachtrij na een crash, twee tabbladen (slot en BroadcastChannel), haperende tikken met handschoenen, Merlin tijdens een trektelling, een back-up twee keer terugzetten, CSV met komma's en aanhalingstekens, soorten die het model verzint. Dit plan legt vast wat nog open staat en hoe we het blijvend afdekken, zodat het niet bij één keer nalopen blijft.

## Wat nog open staat

Op volgorde van kans in het veld. "Soort" zegt hoe we het afdekken: **test** (Vitest, nagebootst), **veld** (zelf op de telefoon proberen, staat op de checklist hieronder) of **let op** (geen code, wel in de kwaliteitsronde).

| # | Geval | Soort | Wat we willen |
| --- | --- | --- | --- |
| 1 | **Wifi met een inlogpagina** (trein, camping, hotel): de telefoon is "online", maar elk verzoek krijgt een HTML-pagina met status 200 | test | Geen geslaagd antwoord maar "geen bereik": de uitspraak wacht en gaat vanzelf door zodra er echt internet is |
| 2 | **Telefoon vol**: een lange trektelling bewaart veel audio; IndexedDB geeft een `QuotaExceededError` | test + veld | De gebruiker merkt het (trilpatroon "mislukt", melding op het scherm), niet stil een opname kwijt; een trektelling stopt met uitleg |
| 3 | **Stop terwijl de wachtrij nog bezig is** (met de offline wachtrij soms uren) | test | Sessienaam, "alles genoteerd?", "Alles klopt" en export houden rekening met wat nog binnenkomt; wat na Stop binnenkomt hoort gewoon bij de sessie |
| 4 | **Met de hand bewerken terwijl een stemcorrectie voor dezelfde waarneming wordt verwerkt** | test | Vaste, uitlegbare volgorde; geen correctie die stil een handmatige wijziging overschrijft |
| 5 | **Rare aantallen**: "nog vijf eraf" bij drie, "die laatste weg" of "ongedaan" bij een lege sessie, "zo'n tweeënhalfduizend", "geen grutto's" | test | Altijd een tril die klopt (twee = niet begrepen), nooit stilte en nooit een aantal onder 1 |
| 6 | **Verwijzing buiten de context**: "die buizerd van een kwartier geleden" na 30 waarnemingen | test + testset | Onzeker of niet begrepen, niet de verkeerde waarneming aanpassen |
| 7 | **Stemmen of geluid van anderen** in een trektelstuk: een medevogelaar, een autoradio, wind die langs de stiltedetectie komt en waar de spraakherkenning tekst bij verzint | veld + testset | Geen waarnemingen uit andermans zinnen of verzonnen tekst; een paar opnames hiervan in de testset |
| 8 | **Klok**: sessie over middernacht, omschakeling naar zomertijd (29 mrt 2027), een klok die verspringt | test | Juiste datum per waarneming en bestandsnaam; `checkStaleSession` en de duur nooit negatief |
| 9 | **Snel verplaatsen** (boot naar Terschelling, auto): telt mee als afgelegde afstand voor eBird; waarnemingen buiten Nederland of op zee | test + veld | Besluiten of een boot meetelt (eBird zegt: niet), en wat `/api/area` buiten Nederland teruggeeft |
| 10 | **Nieuwe webcode midden in een sessie** (`server.url`): een Dexie-versiesprong met wachtende uitspraken, of nieuwe webcode in een oude app zonder een native functie | test + let op | Migratie met wachtende uitspraken getest; `native.ts` valt terug als een plugin ontbreekt |
| 11 | **Back-up van een nieuwere versie in een oudere**, of terugzetten tijdens een lopende sessie | test | Duidelijke weigering of veilig toevoegen, nooit een halve import |
| 12 | **Gebeld worden midden in een opname of trektelling**: het microfoonspoor wordt gedempt of stopt | veld + test | Wat al opgenomen is blijft bewaard; een trektelling pauzeert zoals bij Merlin |
| 13 | **Feedback als prompt injection**: getypte feedback van testers komt via `npm run feedback -- notes` bij Claude Code terecht | let op | Feedback is gegevens, nooit instructies; zo in de werkwijze en de kwaliteitsronde |

## Fasen

1. **Wifi-inlogpagina** (#1): een antwoord dat geen JSON is, of status 511, telt als geen bereik (status 0), zodat de offline wachtrij het oppakt. Met een test in de wachtrij. Kleine PR.
2. **Tests voor de wachtrij en de sessie** (#2, #3, #4, #5, #8): nagebootst in Vitest. Waar een test een fout laat zien, de fix in dezelfde PR, één PR per onderwerp.
3. **Model en testset** (#6, #7): voorbeelden in `interpret.test.ts` voor wat de app met het antwoord doet; voor wat het model zegt een handvol opnames in de testset (andermans stem, wind, verwijzing ver terug).
4. **Veldchecklist** (#2, #7, #9, #12): een vast rijtje "probeer dit eens" in de skill `veldtest-review`, zodat het bij elke veldtest langskomt.
5. **Structureel**:
   - In `src/test-helpers.ts` een paar storingen klaarzetten die elke test kan gebruiken: netwerk weg, inlogpagina, trage proxy, opslag vol, klok verzetten. Een nieuwe test over de wachtrij hoort ze allemaal langs te lopen.
   - In `docs/kwaliteitsronde.md` een stap "edge cases": deze tabel nalopen, nieuwe gevallen erbij, afgedekte eruit (met de test of PR erbij).
   - Bij een bug uit het veld eerst een test die hem laat zien, dan de fix (zo bleef ook de offline wachtrij heel).

## Afgedekt

Wat af is, komt hier met de test of PR erbij, en gaat uit de tabel.
