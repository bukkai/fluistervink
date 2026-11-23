# Draaiboek 4: vóór de laatste release naar stable

Wat er sinds de vorige release (21 nov, 0c31293) op `main` staat en straks bij de testers komt, één keer op de telefoon nalopen. Op de beta, met de Android-app. Vink af wat werkt; schrijf bij een afwijking op wat je zag en spreek het in als feedback. Daarna `npm run release`. Als alles af is, gaat dit draaiboek naar `docs/archief/`.

Duur: thuis een kwartier, buiten een half uur tot drie kwartier.

**Wat er meegaat** (alleen wat testers merken; de rest zit achter een ontwikkeloptie of is van de eigenaar):

- Model: dezelfde soort nog eens is een nieuwe waarneming (#342), feedback wordt nooit uitgevoerd en een andere soort zonder "die" is nieuw (#346), "lifer" is geen soort (#351), "die hadden we al" is geen nieuwe waarneming (#356).
- Nalopen: soortveld (#344), aanpassen maakt een onzekere zeker (#347), afschermen en embargo (#343, #345, al nagelopen op 22 nov).
- Nieuwe gegevens naar de proxy: anonieme cijfers per sessie en verbruik met labels (#353–#355), met Privacy en een schakelaar bij Instellingen.
- Android en iOS uit elkaar in de webcode (#359): raakt aanmelden met Play Integrity, de service, opslaan in Downloads en de Android-uitleg. Op Android hoort er niets te veranderen; dat is precies wat hier nagelopen wordt.
- Elke spreekpoging in het log (#361).

Geen nieuwe app-versie nodig: sinds v0.6 is in `android/` alleen de versienaam veranderd.

## R. Thuis (een kwartier)

**Android-app na #359** (de beta-app, gewoon geopend)

- [ ] Openen gaat zonder melding of foutscherm; Instellingen toont de versie.
- [ ] Sessie starten: de melding "Fluistervink" staat in de balk (de service). Stoppen: de melding verdwijnt.
- [ ] Een uitspraak met de knop: één korte tril.
- [ ] Instellingen → back-up maken: het bestand komt in Downloads (niet het deelmenu van de browser).
- [ ] `#uitleg`: de Android-alinea's (trillen met het scherm uit, de melding) staan er, de tekst voor de browser niet.
- [ ] Developer → log: geen fout bij aanmelden (Play Integrity) of `walk_service_failed`.

**Statistieken en Developer** (#353–#355, de drie punten uit `NOTES.md`)

- [ ] Developer: de oude cijfers staan er als "Onbekend" per functie; de uitspraak van zonet heeft een functie, versie en taal.
- [ ] Statistieken: trechter en "Blijven ze?" tonen echte installaties.
- [ ] Anonieme cijfers als tester: in een privévenster de beta openen zonder eigenaarscode, een sessie met één uitspraak stoppen en exporteren. Op Statistieken verschijnt hij onder "Hoe sessies gaan".
- [ ] Instellingen: de schakelaar voor de anonieme cijfers staat aan en is uit te zetten; `#privacy` noemt ze.

**Nalopen** (#344, #347)

- [ ] Soortveld: typ "corv": de suggesties hebben een eigen kleur, staan boven Opslaan en tonen de wetenschappelijke naam.
- [ ] Een onzekere waarneming: verander het aantal en sla op. Het vinkje onzeker is weg.

**Wat er nieuw is**

- [ ] `#nieuw` op de beta: de regels van 22 en 23 nov lezen goed voor een tester (geen ontwikkelopties, geen technische termen).

## S. Buiten (een half uur tot drie kwartier)

Een gewone sessie zoals een tester hem gebruikt: wandeling of fietsrit, knop of volumeknop, scherm mag uit. Ontwikkelopties zoals je ze normaal hebt. Accu noteren: …%.

**De gewone zinnen.** Spreek deze in tussen echte waarnemingen door, in deze volgorde:

1. "Twee merels" → 2 Merels.
2. Even later: "een merel" → een **nieuwe** waarneming, niet genegeerd (#342).
3. "Nog een merel" → telt op bij de vorige (aantal 2).
4. "Drie grasmussen", even later "een graszanger" → een nieuwe graszanger; de grasmussen blijven (#346).
5. "Feedback, die merel was eigenlijk een zanglijster" → alleen feedback; de merel blijft een merel (#346).
6. "Een kauw. Die hadden we al." → geen tweede kauw (#356).
7. "Een appelvink, was een lifer" → één appelvink, geen (onzekere) lijster en geen correctie (#351).
8. "Spreeuwen, niet geteld" → aantal "gezien niet geteld".
9. "Nee, keep in plaats van vink" na "roepje vink" → de vink wordt een keep.
10. "Die laatste weg" → de laatste verdwijnt.

- [ ] Elke uitspraak gaf de verwachte tril, ook met het scherm uit.
- [ ] Geen dubbele of verdwenen waarnemingen na ontgrendelen.

**Met het selfie-stick-knopje** (als je het bij je hebt; #361, uit `NOTES.md`)

- [ ] Een paar uitspraken met het knopje, gesproken bevestiging aan.
- [ ] Thuis in Developer → log de regels `speak`: `gesproken: true` zonder dat je iets hoorde = geluid onderweg kwijt; `geen oortjes` = de koptelefoon even niet gezien. Uitkomst in `NOTES.md`.

**Als er tijd is:** deel C van `docs/draaiboek-buiten.md` (opnames voor de testset: iemand anders die een vogel noemt, radio, wind, Latijnse namen, beginnerswoorden). Niet nodig voor de release.

**Thuis afmaken**

- [ ] Sessie stoppen. Onzekere één voor één nalopen, "Alles klopt".
- [ ] "Klaar voor waarneming.nl" en de CSV maken; hij opent zonder melding in de bulkimport (alleen de controlestap, niet echt importeren als je dat niet wilt).
- [ ] Delen, `npm run feedback -- pull`, `npm run testset` op deze sessie.
- [ ] Accu noteren: …%.

## Uitkomst

- Alles groen: `npm run release`, daarbij de changelog inkorten (`docs/omgevingen.md`). Daarna de testers mailen (`docs/lancering.md`, punt 4) en de kwaliteitsronde op de beta.
- Gaat er iets mis in R (Android na #359): niet releasen, eerst een fix op `main`.
- Gaat er iets mis met het model in S: kijken of de testset het ook laat zien; een fix in de prompt kan na de release met een volgende `npm run release`, de app hoeft er niet voor opnieuw naar Play.

## Niet nodig voor deze release

Achter een ontwikkeloptie of alleen in de beta-build, dus testers merken er niets van: oortjesmicrofoon (`draaiboek-buiten.md`, A), sluiterknopje met het scherm uit (B), kinderstem (`draaiboek-thuis.md`, G, begin december), tuintelling en `walk_service_failed` (`draaiboek-telling.md`, B en C), de iOS-proef.
