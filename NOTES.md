# Stand van zaken

Werklog om tussen computers te schakelen: alleen wat nu speelt en wat nog moet. Lees het aan het begin van een sessie en werk het bij aan het eind. Houd het kort: is een onderwerp af, haal het hier weg (de PR's op GitHub vertellen wat er gebeurde; een langere geschiedenis kan naar `docs/archief/werklog-2026.md`).

Waar de rest staat: ontwerp en afspraken in `CLAUDE.md`, de richting in `docs/roadmap.md`, ideeën in `docs/ideeen.md`, sleutels en Android-weetjes in `docs/beheer.md`, een overzicht van alle documenten in `docs/README.md`.

## Nu (12 nov)

- **Lancering in Play** (`docs/lancering.md`): gesloten test loopt sinds 9 nov. Nog: 15–20 testers werven en de deelnamelink sturen; plafond en daglimiet bij OpenAI en Anthropic nalopen.
- **Code opruimen:** drie PR's gemerged (#222 gedeelde stijlen, datumopmaak en één audiospeler; #223 "walk" uit de code; #224 `geo.ts`, `worker/feedback.ts`, `StillBirding.svelte`). Nog één stap, pas na de lancering: `src/lib/observations.ts` (ruim 1.000 regels) splitsen in wachtrij, acties toepassen en bewerken, als pure verplaatsing.
- **Laatst gemerged:** opruimen (#222–#224), eBird-export deel 1 (#220), samenvatting zonder "nieuw dit jaar" (#219), inspreekknop hoger en "Wat zei ik?" weg (#218), trektelling zonder lege tril bij Stop (#217), kandidaten-fix (#216).

## Na het mergen nog proberen

Uit de PR's van 6–12 nov; elk punt na het proberen hier weghalen.

- **eBird** (ontwikkeloptie, `docs/plan-ebird.md`): een wandeling en een fietstocht naast Strava of Komoot vergelijken (#212; telling van overgeslagen metingen in het log, `distance_fixes`). Een eigen sessie echt importeren bij eBird en noteren welke soorten "Fix Species" nodig hadden; in de Android-app nagaan of het uploadveld de .csv neemt (#220). Daarna beslissen over deel 2 (soortnamen van eBird) en fase 3 (voor iedereen).
- **Opname afspelen** (#222): op de telefoon bij het nalopen en in het bewerkformulier een opname afspelen; nog eens tikken moet pauzeren (⏸), en een tweede opname stopt de eerste.
- **Twijfel tussen soorten** (ontwikkeloptie, #214/#216): "tjiftjaf of fitis" inspreken (moet zonder 400-fout), een paar wandelingen, dan `npm run testset -- <export> --kandidaten` naast een gewone run. Daarna beslissen of hij voor iedereen aangaat.
- **Bereik als schatting** (#215): na een wandeling met grote groepen nagaan of het model "tussen de vijftig en honderd" als schatting met opmerking geeft.
- **Ontwikkelopties** stem en "voorbeeldzin wordt onzeker" een paar wandelingen meenemen en per optie beslissen ("Roepje vink" kan echt zijn: tellen hoe vaak hij terecht aanslaat).
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
