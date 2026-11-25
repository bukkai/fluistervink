# Plan: robuustheid (edge cases)

18 nov 2026. Status: fase 1 (#268), 2 (#273) en 3–5 (code, tests en checklists) klaar. Kwaliteitsronde 18 nov: #9 besloten, #14–#16 erbij en afgedekt (#279). Kwaliteitsronde 21 nov: #17 erbij en afgedekt. 22 nov: uitspraken om te proberen (uit de stresstest van tester app-b726a027), #18 erbij en afgedekt, de nieuwe gevallen als tekst tegen het model geprobeerd. Open: proberen op de telefoon en opnames voor de testset; zie de tabel.

Een rondgang "wat zou een tester proberen?" langs de bestaande tests en code. Veel is al afgedekt: netwerk weg op elk moment, de wachtrij na een crash, twee tabbladen (slot en BroadcastChannel), haperende tikken met handschoenen, Merlin tijdens een trektelling, een back-up twee keer terugzetten, CSV met komma's en aanhalingstekens, soorten die het model verzint. Dit plan legt vast wat nog open staat en hoe we het blijvend afdekken, zodat het niet bij één keer nalopen blijft.

## Wat nog open staat

Wat de code en de tests niet kunnen afdekken. Op de telefoon proberen: de checklist "Op de telefoon proberen" in de skill `veldtest-review`.

| # | Geval | Nog te doen | Door wie |
| --- | --- | --- | --- |
| 2 | **Telefoon vol** | Op de telefoon proberen (veldchecklist). Later misschien vooraf waarschuwen met `navigator.storage.estimate()` | eigenaar |
| 6 | **Verwijzing buiten de context** ("die buizerd van een kwartier geleden" na 30 waarnemingen) | De app-kant is afgedekt (zie onder); sinds #303 krijgt het model 20 waarnemingen in plaats van 10. Of het model dan "niet begrepen" of onzeker kiest in plaats van de verkeerde buizerd: een paar opnames in de testset | eigenaar inspreken, daarna `npm run testset` |
| 7 | **Stemmen of geluid van anderen** in een trektelstuk (medevogelaar, radio, wind) | Opnames voor de testset; de prompt alleen aanpassen als de testset het laat zien | eigenaar inspreken |
| 12 | **Gebeld worden** | De code is afgedekt (zie onder); nog op de telefoon proberen, ook met Bluetooth-oortjes | eigenaar |
| 19 | **Uitspraken om te proberen** (hieronder) | Inspreken in een sessie, delen, en wat goed gaat als testset-opname bewaren; wat fout gaat wordt een eigen punt in deze tabel | eigenaar inspreken |

## Uitspraken om te proberen

Een tester (app-b726a027) deed op 20 nov in de eerste sessie een stresstest: 27 uitspraken in 18 minuten. Wat er geprobeerd is, staat met de uitkomst in de eerste tabel; de tweede zijn nieuwe gevallen in dezelfde geest. Bij elke veldtest of kwaliteitsronde een paar langslopen (stap "Edge cases" in `docs/kwaliteitsronde.md`); wat goed gaat, bewaren als testset-opname.

**Wat de tester probeerde (20 nov)**

| Uitspraak | Wat er gebeurde | Stand |
| --- | --- | --- |
| "Een mannetje grote bonte specht ter plaatse", "winterkoning en pimpelmees ter plaatse" | goed, ook twee soorten in één zin | goed |
| "Maak van alle voorgaande meldingen twee vogels" | drie aanpassingen | goed |
| "Maak het laatste ongedaan" | undo | goed |
| "Maak alle vorige meldingen afgeschermd", "onder embargo" | niet begrepen | `docs/archief/plan-afschermen.md` |
| "Houtsnip raamslachtoffer", dan "is dood", dan "met het raam gebotst" | goed, in drie stappen | goed |
| "Onbekend aantal kauwtjes, alleen gehoord" | aantal 1, exact | nu "gezien niet geteld" (regel in de prompt, 22 nov) |
| "Een goudhaantje, maar de kever niet de vogel" | werd de vogel Goudhaan | #334 (insecten) |
| "Eén deltavliegen" (geen dier) | Vliegenvanger onbekend, onzeker | **open:** hoort niets te zijn |
| "Female onbekend" | onzeker, met de vraag waar het bij hoort | goed |
| "Een meeuw, grote meeuw, maar onbekend welke" | Meeuw onbekend, onzeker | goed |
| BSN zonder en met "feedback" | zonder genegeerd, met bewaard en gedeeld | #18: gaat nu niet meer mee |
| "Zet de sessie stop", "Stop" | genegeerd | bewust: stoppen met de stem pas met het wake word |
| "Een ijsbeer vijfduizend kilometer ten noorden van hier" | Zoogdier onbekend, onzeker; afstand genegeerd | goed |

**Nieuwe gevallen**

Proef 22 nov: als tekst tegen het model (testset met een nagemaakte export, zonder opnames), zonder spraakherkenning. Wat met de telefoon moet, staat in de laatste kolom als "telefoon".

| Onderwerp | Uitspraak | Wat hoort | Proef 22 nov |
| --- | --- | --- | --- |
| Verwijzing op volgorde | "Maak van de tweede twee vogels" | de op één na laatste waarneming, of onzeker | goed (5×) |
| Uitzondering | "Verwijder alles behalve de specht" | alle andere weg, de specht blijft | goed (5×) |
| Dubbele undo | twee keer "ongedaan maken", dan "toch niet" | één stap terug (redo) | niet geprobeerd; undo en redo zelf hebben tests |
| Soort en aantal tegelijk | "Die meeuw was een zilvermeeuw, en het waren er drie" | één aanpassing met soort en aantal | **ging soms mis** (afschermvelden in `update_observation`, sinds #338): opgelost met een eigen tool voor afschermen, #340 |
| Ver terug | correctie op een waarneming van meer dan 20 terug | niet begrepen of onzeker, niet de verkeerde (#6) | niet geprobeerd |
| Onbekend aantal | "onbekend aantal kauwen", "een heleboel spreeuwen", "veel graspiepers" | telmethode gezien niet geteld, niet onzeker; eBird een X | goed, NL en EN (#336) |
| Ongeldig aantal | "nul vinken", "een halve houtduif", "min twee" | niet begrepen of onzeker (#5) | goed: nul → niets; half en min → 1 en 2, onzeker |
| Grote aantallen | "duizenden spreeuwen" tegenover "dertigduizend spreeuwen" | schatting 3000 tegenover 30.000 exact | goed |
| Persoonsgegevens | naam, adres of telefoonnummer, met en zonder "feedback" | zonder: niets; met: bewaard, cijfers niet gedeeld (#18) | goed: zonder "feedback" niets |
| "Feedback" als waarneming | "feedback: twee buizerds" | het model kiest; nagaan wat het doet | gaat niet naar het model: de app bewaart het als feedback, geen waarneming |
| Geluid van anderen | radio, tv, zingen of een medevogelaar op de achtergrond | geen waarnemingen (#7) | goed als tekst ("en dan nu het weer …" → niets); telefoon |
| Scheldwoord of kreet | "verdomme, weg is ie" | niets | goed |
| Verleden tijd | "gisteren zag ik hier een ijsvogel", "vanochtend zat hier nog …" | onzeker, met de tijd in de reden (de tijd van de opname klopt niet) | **ging mis** (gisteren → niets, vanochtend → niet onzeker): regel in de prompt, nu goed, NL en EN; "net zag ik" blijft gewoon |
| Plek zonder windrichting | "vijf meter achter me", "op de kerktoren" | plek in de woorden, geen verschuiving | goed (opmerking) |
| Ander land | "in België" terwijl je in Nederland staat | opmerking, geen plek | goed (plekomschrijving, geen verschuiving) |
| Huisdier | "een kat", "de hond van de buren", "drie koeien in de wei" | niets | **kat ging mis** (Zoogdier onbekend, onzeker): regel in de prompt, nu goed, NL en EN |
| Fictief of uitgestorven | "een dodo", "een draak" | niets | dodo goed; draak → Draaihals, onzeker (een verstaanfout is daar ook goed denkbaar) |
| Ontsnapte vogel | "een parkiet", "een pauw in de tuin" | Halsbandparkiet onzeker; pauw als exoot of niets | goed: Halsbandparkiet of Grote Alexanderparkiet; pauw → Vogel onbekend, onzeker |
| Dubbele namen | "een uil", "een vos", "een reiger" | de gewone betekenis | vos en reiger (Reiger onbekend) goed; uil → Vogel onbekend, onzeker; "Uil onbekend" staat sinds de soortenlijst van 24 nov in de prompt, nog nagaan of het model hem kiest |
| Volumeknop met podcast of tijdens bellen | indrukken | opname start niet stil; zie veldchecklist | telefoon |
| Correctie in de wachtrij | offline: "drie vinken", dan "nee, keep" | na bereik eerst de vinken, dan de keep (plan-offline) | telefoon (de wachtrij zelf heeft tests) |
| Stoppen midden in een opname | Stop tijdens het inspreken | de opname wordt bewaard en verwerkt | telefoon |

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
- **#18 Persoonsgegevens in feedback** (feedback 20 nov: een tester sprak een BSN in, als feedback; dat ging mee naar de proxy en is op 22 nov met de hand weggehaald): bij het delen laat de app cijferreeksen van acht of meer cijfers (BSN, telefoonnummer, rekeningnummer, IBAN) en e-mailadressen weg uit de tekst, de uitvoer van het model en de teksten bij waarnemingen, en de opname van zo'n uitspraak gaat niet mee (`src/lib/personalData.ts`, `share.ts`). Op de telefoon blijft alles staan. Aantallen ("30.000"), tijden en datums blijven. Namen en adressen zijn niet te herkennen; de privacypagina vraagt ze niet in te spreken. Gekozen voor de app in plaats van de prompt: werkt ook voor uitspraken zonder "feedback" en hangt niet af van het model. Tests in `personalData.test.ts` en `share.test.ts`.
- **#20 Meer dan 200 sessies met anonieme cijfers** (kwaliteitsronde 24 nov): `summaries.ts` onthield alleen de laatste 200 verstuurde sessies, terwijl een geëxporteerde sessie altijd in aanmerking blijft. Vanaf de 201e ging bij elke ronde een oude sessie opnieuw, zonder einde, en telde Statistieken dubbel. Nu blijft elke verstuurde sessie in de lijst zolang hij bestaat; verwijderde vallen eruit. Tests "stuurt een oude sessie ook na honderden andere niet opnieuw" en "vergeet verwijderde sessies" in `summaries.test.ts`.
- **#21 Een uitspraak die de app steeds laat vastlopen** (ronde vóór productie, 25 nov): een uitspraak die midden in het verwerken bleef hangen, ging bij elke start terug in de wachtrij, zonder grens, en werd nooit "mislukt". Nu telt `interrupted` mee; bij de derde keer mislukt hij met de opname bewaard en "Opnieuw" (`MAX_INTERRUPTED` in `queue.ts`). Tests onder "wachtrij".
- **#22 Een uitspraak die binnenkomt terwijl de wachtrij afrondt** (ronde vóór productie, 25 nov): `processQueue` deed dan niets, omdat de vorige ronde nog liep, en de uitspraak bleef liggen tot de volgende uitspraak of een herstart. Nu volgt er een nieuwe ronde. Test onder "wachtrij". Daarbij: de spraakherkenning van een verouderde poging (bevroren exemplaar) schrijft geen transcript meer, net als het opslaan van waarnemingen (`isCurrentAttempt`). Test onder "netwerk weg".
- **#23 Opnames met het scherm uit terwijl de app dicht was** (ronde vóór productie, 25 nov): `wachtend` werd alleen opgehaald bij het begin van een sessie met het scherm uit en bij het stoppen; zonder volgende sessie bleven ze op de telefoon. Nu ook bij het opstarten (`collectPendingScreenOffRecordings`); van een verwijderde sessie gaat het bestand weg. Test in `screenOff.test.ts`.
