# Draaiboek 1: thuis aan tafel

Proeven op de telefoon die geen buiten en geen telling nodig hebben. Op de beta, met de Android-app. Vink af wat werkt; schrijf bij een afwijking op wat je zag en spreek het in als feedback ("feedback, …"). Na afloop de sessies stoppen en delen, dan `npm run feedback -- pull`. Een punt dat werkt, gaat uit `NOTES.md`; als alles af is, gaat dit draaiboek naar `docs/archief/`.

Duur: ongeveer 30 minuten, plus een kind voor ronde G.

## Uitslag 22 nov

A t/m F doorgelopen (17:08–17:54, beta), G geparkeerd tot begin december (neefje en nichtje). Goed: B, C, D, F. Gevonden:

- **A, soortveld:** de eerste keer viel de suggestielijst achter de balk met Opslaan (later scrolde het veld wel meteen omhoog); de lijst mag een eigen kleur krijgen zodat hij opvalt. Bij "ree" staat de verzamelsoort "Gewone Pad/ Rugstreeppad" met de groep (twee woorden) niet rechts uitgelijnd. Bij "corvus" toont alleen de bovenste (Corvus monedula) de wetenschappelijke naam, de rest de Nederlandse. Vraag: waarom vult het typveld bovenaan de sessie niet aan? (Daar typ je een hele uitspraak die naar het model gaat, met aantal en gedrag.)
- **D:** in de uitleg bij "Scherm aan houden" "zoals bij een recepten-app" weglaten.
- **E:** in een uitspraak met meer dieren gaf het model alleen het eerste terug als dat niet in de lijst staat: "een vliegend hert, een gewoon hert" → alleen het vliegend hert; "één wolf, twee knoflookpadden, drie korenwolven" → alleen de wolf (los ingesproken gingen ze goed). "Een hommel" een tweede keer werd genegeerd ("staat al als #8"). "Een gewoon hert" → Hert onbekend, zeker.

## Voorbereiding

- [ ] Beta-app bijgewerkt (de webcode komt live van de site; even helemaal afsluiten en opnieuw openen).
- [ ] Instellingen → "Ook andere dieren inspreken" aan.
- [ ] Ontwikkelopties `insecten` en `english` nog uit (die komen in ronde E en F).
- [ ] Een nieuwe sessie starten, naam "Draaiboek thuis".

## A. Soortveld (#233)

Het soortveld heeft een eigen suggestielijst in plaats van het Android-venstertje dat over de lijst bleef hangen.

- [ ] Spreek "een vink" in, open de waarneming, tik in het soortveld en wis de naam.
- [ ] Typ "noordse": onder het veld staan hooguit acht soorten (Noordse Stern, Noordse Pijlstormvogel, …), niet als los venstertje erover.
- [ ] Het toetsenbord gaat open: de lijst schuift mee, er blijft niets half over de waarnemingen staan.
- [ ] De ronde knop Inspreken is weg zolang je typt, ook als je naar het veld Aantal tikt.
- [ ] Eén tik op een suggestie vult het veld en sluit de lijst (niet twee keer tikken).
- [ ] Typ "kievit": Kievit en Indische Kievit staan er allebei.
- [ ] Typ "ree": de groep staat erbij ("zoogdieren").
- [ ] Typ "corvus": soorten op wetenschappelijke naam (Kraai, Roek, …).
- [ ] Annuleren: de waarneming is nog een vink, Inspreken is terug.

## B. Opslaan in beeld (#237)

- [ ] Open tijdens de sessie een waarneming: Opslaan staat meteen in beeld onderaan, zonder scrollen.
- [ ] De ronde knop Inspreken ligt niet over Annuleren of Opslaan.
- [ ] Hetzelfde met het toetsenbord open (tik in Opmerking).

## C. Instellingen (#234, #235, #304, #306)

- [ ] De groepen staan van het veld naar thuis: Wat de app verstaat, Bediening in het veld, Tellen, Nalopen en export, je gegevens.
- [ ] "Bediening in het veld" heeft de volumeknop, de gesproken bevestiging, scherm aan houden en de twee ontwikkelopties (oortjesmicrofoon, scherm uit).
- [ ] De ontwikkelopties staan in hun eigen groep, met een label.
- [ ] "Ook andere dieren inspreken" staat aan; spreek "een ree" in: Ree, niet Zoogdier onbekend.
- [ ] Volumeknop staat aan, gesproken bevestiging uit (standaard). Zet de gesproken bevestiging weer aan als je hem wilt.
- [ ] Achteraf: de Play-tekst bijwerken als de indeling daar genoemd wordt (`docs/play-store/README.md`).

## D. Scherm aan houden (#328)

- [ ] Instellingen → "Scherm aan houden tijdens een sessie" aan.
- [ ] Sessie open, telefoon twee minuten neerleggen: het scherm blijft aan (langer dan je normale time-out).
- [ ] Volumeknop indrukken en "een merel" inspreken zonder het scherm aan te raken.
- [ ] Met de aan-uitknop op slot, weer ontgrendelen: het scherm blijft daarna weer aan.
- [ ] Sessie stoppen: het scherm gaat na je normale time-out weer vanzelf uit.
- [ ] Optie weer uit (of aan laten als je het prettig vindt).

## E. Insecten en zeldzame dieren (#334, 9737137)

Ontwikkeloptie `insecten` aan. Een opgezocht insect is altijd onzeker (de spraakherkenning kent die namen niet), met de gezegde naam in de twijfelreden.

- [ ] "een hommel" → een hommel, onzeker.
- [ ] "twee aardhommels" → 2 × aardhommel, onzeker.
- [ ] "een goudhaantje" → blijft de vogel Goudhaan.
- [ ] "goudhaantje, de kever, niet de vogel" → Goudhaantje (kever) onbekend, onzeker.
- [ ] "een vliegend hert" → Vliegend hert, onzeker.
- [ ] In het soortveld "aardhom" typen: de aardhommel staat in de lijst.
- [ ] "een wolf", "twee knoflookpadden", "drie korenwolven" → die soort, onzeker ("Dwaalgast, niet in de vaste lijst"), niet "Zoogdier onbekend".
- [ ] Ontwikkeloptie `insecten` weer uit: "een hommel" geeft nu geen hommel (wel onzeker of niets).

## F. English (#299, #300, #314)

Ontwikkeloptie `english` aan; de app laadt opnieuw in het Engels.

- [ ] Schermen in het Engels, ook Uitleg (How it works), Privacy, het welkom en "Try it".
- [ ] "six Woodpigeons flying over" → 6 Houtduiven, overvliegend.
- [ ] "no, Brambling instead of Chaffinch" (na een Chaffinch) → keep.
- [ ] "three more" → het aantal gaat met drie omhoog.
- [ ] "scratch that last one" → laatste weg.
- [ ] "Buzzard, half a mile north-east" → buizerd, plek ongeveer 800 m noordoost.
- [ ] "a seagull" (#315): het grapje verschijnt in het Engels ("SEAGULL?!", "There's no such thing as a seagull.", met de Engelse namen van de meeuwen).
- [ ] Foutmeldingen bij een uitspraak zijn Engels (#316). Lastig op te wekken; let erop als er toevallig een mislukt (time-out, daglimiet).
- [ ] Bekend en goed zo: de gesproken bevestiging klinkt met een Nederlandse stem; "Wat is er nieuw" en de Android-meldingen blijven Nederlands.
- [ ] Ontwikkeloptie weer uit: de app is weer Nederlands.

## G. Kinderstem (#327)

Voor de regel "Leuk met kinderen" op de tuintellingpagina. Liefst een jong en een ouder kind, elk in een eigen sessie ("Kind 6 jaar", "Kind 10 jaar").

- [ ] "twee pimpelmeesjes" → 2 Pimpelmezen.
- [ ] "een roodborstje" → Roodborst.
- [ ] "nu vijf koolmezen" → 5 Koolmezen (of een correctie, als er al koolmezen waren).
- [ ] Een paar soorten naar eigen keuze.
- [ ] Sessie stoppen en delen (met opnames), zodat ze in de testset kunnen.
- [ ] Gaat het grotendeels goed, dan blijft de regel staan; anders eruit.

## H. Afschermen en embargo (#337–#339)

Na het mergen van #339. Feedback van tester app-b726a027; plan `docs/plan-afschermen.md`. Een eigen sessie, "Afschermen".

- [ ] "een vink", dan "die afschermen" → in de lijst een slotje met "Verborgen op waarneming.nl"; de bevestiging zegt "afgeschermd".
- [ ] "een houtduif", dan "die op vijf kilometer vervagen" → "Vervaagd tot 5 km op waarneming.nl".
- [ ] "een keep", dan "die onder embargo tot 1 maart" → "Embargo tot 1 mrt 2027".
- [ ] "een draaihals, nest, afschermen" → nieuwe waarneming, meteen verborgen, niet onzeker.
- [ ] "alle vorige afschermen" → alle waarnemingen in de lijst krijgen het slotje.
- [ ] "een merel onder embargo" (zonder datum) → onzeker, "kies de datum". Open hem, kies een datum bij "Embargo tot": Onzeker gaat vanzelf uit. Opslaan.
- [ ] In de bewerker "Op waarneming.nl" terug op Openbaar zetten: het slotje verdwijnt.
- [ ] Sessie stoppen, nalopen, exporteren voor waarneming.nl en **proefimporteren**: komen verborgen, vervaagd en embargo goed binnen? (Daarna de proefwaarnemingen bij waarneming.nl weer verwijderen.)
- [ ] Met eBird aan: exporteren voor eBird → de melding noemt de afgeschermde waarnemingen die niet meegaan.

## Afsluiten

- [ ] Sessie(s) stoppen en delen, met opnames.
- [ ] Bevindingen in `NOTES.md`; werkende punten daar weghalen.
