# Stand van zaken

Werklog om tussen computers te schakelen: alleen wat nu speelt en wat nog moet. Lees het aan het begin van een sessie en werk het bij aan het eind. Houd het kort: is een onderwerp af, haal het hier weg (de PR's op GitHub vertellen wat er gebeurde; een langere geschiedenis kan naar `docs/archief/werklog-2026.md`).

Waar de rest staat: ontwerp en afspraken in `CLAUDE.md`, de richting in `docs/roadmap.md`, ideeën in `docs/ideeen.md`, sleutels en Android-weetjes in `docs/beheer.md`, een overzicht van alle documenten in `docs/README.md`.

## Nu (16 nov)

- **Lancering in Play** (`docs/lancering.md`): gesloten test loopt sinds 9 nov. Nog: 15–20 testers werven en de deelnamelink sturen; plafond en daglimiet bij OpenAI en Anthropic nalopen.
- **Kwaliteitsronde 16 nov** (#236): geen kwetsbaarheden; eBird bij Incidental, tegeltje "Waarnemingen" en `#privacy` (gesproken bevestiging) gerepareerd. Na het mergen: release naar stable (`npm run release`), dan staat de gesloten test op een nagelopen versie.
- **Code opruimen:** drie PR's gemerged (#222 gedeelde stijlen, datumopmaak en één audiospeler; #223 "walk" uit de code; #224 `geo.ts`, `worker/feedback.ts`, `StillBirding.svelte`). Nog één stap, pas na de lancering: `src/lib/observations.ts` (ruim 1.000 regels) splitsen in wachtrij, acties toepassen en bewerken, als pure verplaatsing.
- **Typveld tijdens een sessie** (#231): verloor in de app meteen de focus; gefixt en op de telefoon bevestigd (16 nov). In het log staat nu `keyboard_closed` als het veld loslaat.
- **Soortveld in de bewerker** (#233, open): de `<datalist>` kwam in de app half over de lijst te staan (schermafbeelding 16 nov). Vervangen door een eigen suggestielijst onder het veld (`searchSpecies` in `vocab.ts`); de knop Inspreken gaat nu ook weg bij typen in een geopende waarneming.
- **Testset weekend Terschelling** (13–15 nov, 205 uitspraken, gedeeld op 16 nov): de originele antwoorden 92% helemaal goed; opnieuw met het huidige model 89% met `--soortgroepen`, 85% zonder. Soortgroepen stonden aan, dus vergelijk alleen met `--soortgroepen`. De fouten zitten vooral in de spraakherkenning ("Eén kei" voor zwarte kraai, "koudjes" voor kauwen, "sjokduizers" voor brilduikers). Ree, egel en zeehond gingen met `--soortgroepen` goed, zonder werden ze gemist.
- **Proefopties opgeruimd** (#235, open, bouwt op #234: die eerst mergen): "voorbeeldzin wordt onzeker" weg, twijfel tussen soorten voor iedereen zonder keuze (ook de testset, `--kandidaten` is weg), volumeknop bij de gewone instellingen standaard aan, gesproken bevestiging als proef voor iedereen standaard uit. Ontwikkelopties: nu geen.
- **Laatst gemerged:** feedback alleen met het woord "feedback" (#242), privacy korter (#239), ingesproken feedback uit de teksten (#238), Opslaan in beeld (#237), kwaliteitsronde (#236), eBird afgerond (#232), typveld (#231), opruimen (#222–#224), eBird-export deel 1 (#220), samenvatting zonder "nieuw dit jaar" (#219), inspreekknop hoger en "Wat zei ik?" weg (#218), trektelling zonder lege tril bij Stop (#217), kandidaten-fix (#216).

## Na het mergen nog proberen

Uit de PR's van 6–13 nov; elk punt na het proberen hier weghalen.

- **Andere soortgroepen voor iedereen** (#234, standaard aan): na het mergen in de app nagaan dat "Ook andere dieren inspreken" bij Instellingen aan staat en een ree goed binnenkomt. Import met een zoogdier werkte; vlinders en libellen pas in het voorjaar, dan zien we het vanzelf. Play-tekst in de Play Console bijwerken (`docs/play-store/README.md`).
- **Soortveld** (#233): in de app een waarneming openen, "noordse" typen: de suggesties moeten onder het veld staan (niet over de lijst), één tik kiest de soort, en de knop Inspreken is weg zolang je typt.
- **Feedback alleen met "feedback"** (#242, prompt veranderd): na de eerstvolgende gedeelde sessie de testset draaien; een opmerking over de app zonder het woord "feedback" moet niets worden, met het woord (ook midden in een trektelstuk) gewoon feedback.
- **Opslaan in beeld** (#237): tijdens een sessie een waarneming openen: Opslaan staat meteen onderaan, het ronde knopje staat niet over Annuleren, en inspreken werkt ermee.
- **Opname afspelen** (#222): op de telefoon bij het nalopen en in het bewerkformulier een opname afspelen; nog eens tikken moet pauzeren (⏸), en een tweede opname stopt de eerste.
- **Proefopties** (#235): in de app bij Instellingen staat de volumeknop aan en de gesproken bevestiging uit; die laatste zelf weer aanzetten (de oude ontwikkeloptie telt niet meer). Het kaartje Ontwikkelopties zegt "Op dit moment geen". Na de eerstvolgende gedeelde sessie de testset draaien: de promptversie is veranderd (altijd met kandidaten).
- **Bereik als schatting** (#215): na een wandeling met grote groepen nagaan of het model "tussen de vijftig en honderd" als schatting met opmerking geeft.
- **Latijnse namen** (#157): het model doet het (39/39), maar of de spraakherkenning ze verstaat, is nog niet gemeten. Een paar opnames inspreken en door de testset halen.
- Bij de volgende import naar waarneming.nl een Bonte Kraai meenemen (nieuwe ondersoort, #153).

## Steeds

- Bij elke nieuwe gedeelde sessie `npm run feedback -- pull`, `npm run feedback -- notes` en `npm run testset`.
- Prompt alleen aanpassen als de testset het laat zien. Uit de analyse van 24 okt: de meeste echte fouten zitten in de spraakherkenning (korte uitspraken, verward met een andere vogelnaam), niet in het model.

## Branch-regel op main

Sinds 12 nov een ruleset "main beschermen" (GitHub → Settings → Rules): een PR kan pas gemerged worden als de check `check` groen is; geen force-push, `main` niet te verwijderen. De eigenaar (beheerder) mag er altijd omheen, dus NOTES-commits direct op `main` blijven werken, en een PR met een hangende check kun je toch mergen ("bypass rules"). De PR's van de soortenlijst-workflow krijgen geen check vanzelf (GITHUB_TOKEN): sluiten en heropenen, of omheen mergen.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen staan niet in git: `.dev.vars` per computer zelf aanmaken (zie README), en `.testers.json` meekopiëren als je testers met het script wilt beheren.
