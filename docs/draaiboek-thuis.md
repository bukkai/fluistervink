# Draaiboek 1: thuis aan tafel

Proeven op de telefoon die geen buiten en geen telling nodig hebben. Op de beta, met de Android-app. Vink af wat werkt; schrijf bij een afwijking op wat je zag en spreek het in als feedback ("feedback, …"). Na afloop de sessies stoppen en delen, dan `npm run feedback -- pull`. Een punt dat werkt, gaat uit `NOTES.md`; als alles af is, gaat dit draaiboek naar `docs/archief/`.

Ronde A–F en H gedaan op 22 nov; de afgevinkte stappen zijn eruit (terug te vinden in git). Over: G, met een kind.

## Uitslag 22 nov

A t/m F doorgelopen (17:08–17:54, beta), G geparkeerd tot begin december (neefje en nichtje). Goed: B (opslaan in beeld), C (Instellingen), D (scherm aan houden), F (English). Gevonden:

- **A, soortveld:** de eerste keer viel de suggestielijst achter de balk met Opslaan (later scrolde het veld wel meteen omhoog); de lijst mag een eigen kleur krijgen zodat hij opvalt. Bij "ree" staat de verzamelsoort "Gewone Pad/ Rugstreeppad" met de groep (twee woorden) niet rechts uitgelijnd. Bij "corvus" toont alleen de bovenste (Corvus monedula) de wetenschappelijke naam, de rest de Nederlandse. Vraag: waarom vult het typveld bovenaan de sessie niet aan? (Daar typ je een hele uitspraak die naar het model gaat, met aantal en gedrag.)
- **D:** in de uitleg bij "Scherm aan houden" "zoals bij een recepten-app" weglaten.
- **E:** in een uitspraak met meer dieren gaf het model alleen het eerste terug als dat niet in de lijst staat: "een vliegend hert, een gewoon hert" → alleen het vliegend hert; "één wolf, twee knoflookpadden, drie korenwolven" → alleen de wolf (los ingesproken gingen ze goed). "Een hommel" een tweede keer werd genegeerd ("staat al als #8"). "Een gewoon hert" → Hert onbekend, zeker. Nagemeten 22 nov: het overslaan komt met de huidige prompt nauwelijks terug (echte uitspraken 10/10 goed, nagebouwd ~3–4% mis; een extra promptregel hielp niet). Dezelfde soort nog eens: altijd een nieuwe waarneming (#342).
- **H, afschermen en embargo** (20:29): alles werkte. De eerste import weigerde 5 en 9 (alleen 0 of 1): opgelost in #343, met een melding om het op de site strenger te zetten. Tweede import goed: 1 = vervaagd 1 km, embargo = verborgen tot de datum, de draaihals (nest) kreeg van de site zelf een half jaar embargo. "Openbaar publiceren zonder embargo" liet het embargo staan: #345.

## G. Kinderstem (#327)

Voor de regel "Leuk met kinderen" op de tuintellingpagina. Liefst een jong en een ouder kind, elk in een eigen sessie ("Kind 6 jaar", "Kind 10 jaar").

- [ ] "twee pimpelmeesjes" → 2 Pimpelmezen.
- [ ] "een roodborstje" → Roodborst.
- [ ] "nu vijf koolmezen" → 5 Koolmezen (of een correctie, als er al koolmezen waren).
- [ ] Een paar soorten naar eigen keuze.
- [ ] Sessie stoppen en delen (met opnames), zodat ze in de testset kunnen.
- [ ] Gaat het grotendeels goed, dan blijft de regel staan; anders eruit.

## Nog over uit H

- [ ] Met eBird aan: exporteren voor eBird → de melding noemt de afgeschermde waarnemingen die niet meegaan.

## Afsluiten

- [ ] Sessie(s) stoppen en delen, met opnames.
- [ ] Bevindingen in `NOTES.md`; als alles af is, gaat dit draaiboek naar `docs/archief/`.
