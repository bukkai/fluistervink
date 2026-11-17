# Stand van zaken

Werklog om tussen computers te schakelen: alleen wat nu speelt en wat nog moet. Lees het aan het begin van een sessie en werk het bij aan het eind. Houd het kort: is een onderwerp af, haal het hier weg (de PR's op GitHub vertellen wat er gebeurde; een langere geschiedenis kan naar `docs/archief/werklog-2026.md`).

Waar de rest staat: ontwerp en afspraken in `CLAUDE.md`, de richting in `docs/roadmap.md`, ideeën in `docs/ideeen.md`, sleutels en Android-weetjes in `docs/beheer.md`, een overzicht van alle documenten in `docs/README.md`.

## Nu (17 nov)

- **Lancering in Play** (`docs/lancering.md`): gesloten test loopt sinds 9 nov; sinds 17 nov **12 testers**, twee weken (tot ongeveer 1 dec), daarna productietoegang aanvragen. Bijna alle testers zitten op de gesloten test (stable), de eigenaar op de beta. Nog: plafond en daglimiet bij OpenAI en Anthropic nalopen.
- **Beta → stabiel** (#252, gemerged): de beta-app vraagt testers (niet de eigenaar) over te stappen naar de gewone app. Nagaan dat in de Play Console de adressen van de interne lijst ook in de gesloten lijst staan en de interne lijst leeg is op de eigenaar na (`docs/google-play.md`).
- **Werkwijze tijdens de proef** (#249; `docs/omgevingen.md`, "Nieuwe functies en fixes terwijl testers op stabiel zitten"): nieuwe functies op `main`, het liefst achter een ontwikkeloptie, zodat `main` naar stable kan als er een fix moet. `npm run release` alleen voor fixes, niet voor halve features. Heeft `main` iets dat nog niet mee mag: hotfix-branch vanaf `origin/stable`, PR naar `stable`, daarna PR `stable` → `main` met "Create a merge commit". Native code op `main` die nog niet mee mag: alleen de beta-AAB uploaden.
- **Roadmap na v1.0** (17 nov, `docs/roadmap.md`): eerst offline wachtrij, opnemen met het scherm uit, microfoon delen en wake word; daarna export naar observation.org, een betaalde laag (eerst de kosten per gebruiker uit deze proef), andere landen en Engels.
- **Offline wachtrij** (`docs/plan-offline.md`): gemerged achter de ontwikkeloptie "Wachten op bereik": #251 (wachten in plaats van mislukken, vanzelf verder), #254 (trilpatroon lang, kort en regel op het sessiescherm), #255 (trektelling trilt na 2 uur wachten, token opnieuw aanvragen). **#256 (open, checks groen)** zet hem voor iedereen aan: optie weg, gebieden en sessienaam alsnog na het inhalen, klaarzetten en losse export pas als alles verwerkt is, `#uitleg`, changelog, `CLAUDE.md`. Alleen webcode, geen nieuwe APK. **Pas mergen na de proeven** (checklist in de PR), met de optie aan op de beta: PWA en Android-app openen in vliegtuigmodus (de app laadt de webcode van de site; opent hij niet, eerst overleggen), een wandeling zonder netwerk met een correctie erin, stoppen terwijl er nog uitspraken wachten, een korte trektelling offline. Changelog staat op 17 nov: bij een latere merge de datum aanpassen.
- **Opnemen met het scherm uit** (#253, draft, **niet mergen vóór de productierelease**: het servicetype `microphone` vraagt een nieuwe verklaring bij Google, dus ook geen tag met deze code): proef achter een ontwikkeloptie, main zit erin. Debug-APK `apk/fluistervink-0.762-scherm-uit-proef.apk` laadt de webcode van de preview; die gaf "Interne fout in de proxy" (geen KV, D1 en snelheidslimiet in de preview), het blok `previews` in `wrangler.jsonc` is aangevuld. Nog nagaan met de toegangscode of de proxy op de preview nu werkt, daarna op de telefoon proberen. Daarna: knop op de oortjes en keuze van de microfoon (latere PR), microfoon delen, wake word.
- **Kwaliteitsronde 16 nov:** stable staat sinds 16 nov op d42fca4 (gesloten test dus op een nagelopen versie). Tweede ronde direct na de release: #243 (Opslaan boven de trektelknop, feedbacktekst, privacy). Geen nieuwe AAB nodig: sinds v0.3 niets native veranderd behalve Capacitor 8.6.2.
- **Plek en trektelstukken** (#248): gemerged en gereleased, stable staat op a09eff6. Na te lopen hieronder.
- **Kokmeeuw 16 nov:** "Juveniele kokmeeuwen, ik denk derde kalenderjaar" werd juveniel (het eerste woord, volgens de regel in de prompt), onzeker met de reden. Promptregel "de preciezere leeftijd wint" alleen als het vaker voorkomt.
- **Testset weekend Terschelling** (13–15 nov, 205 uitspraken, gedeeld op 16 nov): de originele antwoorden 92% helemaal goed; opnieuw met het huidige model 89% met `--soortgroepen`, 85% zonder. Soortgroepen stonden aan, dus vergelijk alleen met `--soortgroepen`. De fouten zitten vooral in de spraakherkenning ("Eén kei" voor zwarte kraai, "koudjes" voor kauwen, "sjokduizers" voor brilduikers). Ree, egel en zeehond gingen met `--soortgroepen` goed, zonder werden ze gemist.
- **Laatst gemerged:** opruimen (#246 `observations.ts` gesplitst, #247 `keyboard.ts` en exports), Developer overzichtelijker, kosten bovenaan en de rest inklapbaar (#245), verwerkte feedback wissen, week aantikken in Statistieken en "op dit apparaat" (#244), kwaliteitsronde na de release (#243), feedback alleen met het woord "feedback" (#242), statistieken per week (#241), instellingen gesplitst en samenvatting altijd aan (#240), privacy korter (#239), ingesproken feedback uit de teksten (#238), Opslaan in beeld (#237), kwaliteitsronde (#236), proefopties opgeruimd (#235), andere soortgroepen voor iedereen (#234), soortveld (#233), eBird afgerond (#232), typveld (#231).

## Na het mergen nog proberen

Uit de PR's van 6–16 nov; elk punt na het proberen hier weghalen.

- **Plek in een trektelstuk** (#248): een trektelling met een gezegde plek erin ("buizerd, 500 m zuid"): alle soorten van het stuk moeten binnenkomen, met de plek.
- **Developer en Statistieken** (#244, #245): op Developer "Verwerkte wissen" proberen (verwerkte feedback moet weg blijven, ook na opnieuw delen); kijken of de nieuwe indeling bevalt (kosten bovenaan, de rest ingeklapt). Op Statistieken een week in de grafiek aantikken: die rij in de tabel licht op.
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
