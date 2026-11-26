# Plan: testers die er zelf voor kiezen

23 nov 2026. Status: voorstel, open vragen beantwoord op 24 nov; uitvoeren na de productierelease.

## Waarom

De 12 testers van de gesloten test (sinds 17 nov) waren nodig voor de regel van Google: minstens 12 testers die 14 dagen onafgebroken aangemeld zijn. Een deel test vooral om de eigenaar een plezier te doen. Na de productierelease is die regel niet meer nodig. Dan wil de eigenaar testers die er zelf voor kiezen, omdat ze de app echt gebruiken, en die beheren via een Google Group in plaats van een e-maillijst.

## Hoe het nu zit

- Eén app in Play, twee builds (`docs/google-play.md`, `docs/omgevingen.md`). De **beta** laadt workers.dev en staat in de interne test, alleen voor de eigenaar. De **stabiele** laadt `fluistervink.nl` en staat in de gesloten test ("Stabiel"), straks ook in productie.
- De beta heeft bij dezelfde tag het hogere `versionCode`: wie in beide zit, krijgt de beta. Terug van de beta naar stabiel kan alleen door de app te verwijderen en opnieuw te installeren.
- Gegevens horen bij het adres. Wie van stabiel naar de beta gaat, ziet de eigen sessies niet meer, tenzij er een back-up wordt teruggezet.
- De beta-app vraagt iedereen behalve de eigenaar om over te stappen naar stabiel (`src/lib/MoveToStable.svelte`).
- Wie zich ooit via een deelnamelink heeft aangemeld, blijft tester van die track, ook na weghalen van de lijst (gemerkt 18 nov).

## Stap 1: de huidige testers uitfaseren (direct na de productierelease)

Dit hoeft niet langzaam: de gesloten test en productie hebben dezelfde stabiele build en hetzelfde adres. Wie van de gesloten test af gaat, krijgt de updates uit productie, zonder iets te merken en zonder iets kwijt te raken.

1. In de gesloten test "Stabiel" geen nieuwe releases meer zetten. De volgende stabiele AAB gaat alleen naar Productie; die heeft het hogere `versionCode`, dus iedereen op "Stabiel" krijgt hem. Nagaan of Play de track laat stoppen of pauzeren; anders blijft hij gewoon staan.
2. De e-maillijst van "Stabiel" leegmaken (op de eigenaar na).
3. De testers een korte mail: de test is klaar, dank je wel, je hoeft niets te doen, de app blijft gewoon werken. Wie wil blijven testen: later komt er een uitnodiging in de app.
4. `docs/lancering.md` en `NOTES.md` bijwerken; de feedback uit Discord blijft in `testset/feedback/discord/`.

Hetzelfde geldt voor de tweede gesloten track "Stabiel – Sovon" (sinds 26 nov, groep `fluistervink-sovon`, voor de testers van de Sovon-dag): geen nieuwe releases meer, de testers dezelfde mail, de groep opheffen.

Hergebruik "Stabiel" en "Stabiel – Sovon" **niet** voor de nieuwe testers: wie zich daar ooit heeft aangemeld, zou dan zonder het te vragen de beta krijgen.

## Stap 2: een nieuwe track met een Google Group

1. Een Google Group aanmaken, bv. `fluistervink-testers@googlegroups.com`. Instellingen: iedereen mag lid worden, ledenlijst alleen zichtbaar voor de eigenaar, berichten alleen van de eigenaar. De groep is alleen voor mededelingen aan de testers; feedback blijft op Discord.
2. In de Play Console een nieuwe **gesloten test** "Beta" met die groep als testers. Daar komt de beta-AAB, naast de interne test van de eigenaar. De interne test blijft, want die wordt niet door Google beoordeeld; de nieuwe track wel (uren tot dagen).
3. Bij elke tag: beta-AAB naar de interne test én naar "Beta", stabiele AAB naar Productie. Aanpassen in `docs/google-play.md` (Een nieuwe versie, Testers) en `docs/omgevingen.md`.
4. `MoveToStable.svelte` weghalen of beperken: anders vraagt de beta-app de nieuwe testers meteen weer om weg te gaan. Het eenvoudigst: weghalen, want de eerste testers zijn dan al over.
5. De privacypagina (Nederlands en Engels): wie lid wordt van de groep, deelt het eigen Google-account met de eigenaar (dat deden de testers op de e-maillijst ook al, maar het staat er nog niet).

## Stap 3: wat testers op de beta te zien krijgen

Nieuwe functies staan nu achter ontwikkelopties (`src/lib/devOptions.ts`) die alleen de eigenaar ziet. Dan is de beta voor een tester bijna hetzelfde als stabiel, en valt er weinig te testen.

Voorstel: een ontwikkeloptie kan "voor testers" zijn. Op de beta ziet een tester (niet de eigenaar) die opties bij Instellingen, onder een eigen kopje, standaard uit. De eigenaar kiest per optie of die al zo ver is. Zo blijft een halve proef bij de eigenaar en kan iets dat bijna af is naar de testers, nog voordat het naar stabiel gaat.

Eerst uitwerken: welke opties dan nu "voor testers" zouden zijn, en of dat bij Instellingen moet of in een eigen scherm.

## Stap 4: de uitnodiging op het hoofdscherm (een maand of zo na de productierelease)

Een kaart op het hoofdscherm, direct onder "Start een sessie" (en de knop van de tuintelling, als die er staat), vóór de laatste sessie. Bouwen in `src/lib/BecomeTester.svelte`, aanroepen vanuit `src/lib/Home.svelte`, net als `MoveToStable`.

**Wie hem ziet:** alleen in de stabiele Android-app (`CHANNEL === 'stable' && isAndroidApp`), niet bij de eigenaar, en alleen bij wie de app echt gebruikt:

- minstens 5 gestopte sessies, en
- de eerste sessie minstens 3 weken geleden.

Dat telt de app zelf uit de eigen database; er gaat niets naar de proxy. Een iPhone of de PWA krijgt hem niet: daar is geen Play-test. (Wie op een iPhone wil testen, kan later naar het adres van de beta; eerst navragen of iemand dat wil.)

**Wanneer hij verdwijnt:** "Nee, dank je" verbergt hem voorgoed (localStorage, met try/catch). Op de link tikken ook, want wie tester wordt, krijgt daarna toch de beta-app. "Later" verbergt hem een week.

**Wat er staat** (teksten in `src/lib/i18n/nl.ts` en `en.ts`, hele zinnen):

- Kop: "Wil je nieuwe dingen eerder uitproberen?"
- Kort wat een tester is: je krijgt Fluistervink Beta, met nieuwe dingen voordat iedereen ze krijgt. Soms gaat er iets mis; je feedback (via Discord of Feedback in het menu) helpt.
- Wat er gebeurt met je gegevens: de beta is een aparte plek. Maak eerst een back-up bij Instellingen en zet die in de beta terug. Wat al bij waarneming.nl staat, blijft daar.
- Stappen: (1) back-up maken, (2) lid worden van de groep (link), (3) via de deelnamelink van "Beta" tester worden (link), (4) Play werkt de app bij naar de beta, of anders opnieuw installeren, (5) back-up terugzetten.
- Terug naar de gewone app kan, maar alleen door de beta te verwijderen en Fluistervink opnieuw te installeren, weer met een back-up ertussen.
- Knoppen: "Nee, dank je" en "Later".

Eerst nagaan op het tweede account (zie Besloten): werkt Play de stabiele app gewoon bij naar de beta (hoger `versionCode`, zelfde sleutel), of moet je hem eerst verwijderen? Dat bepaalt stap 4 van de kaart.

**Aanzetten:** de kaart eerst als ontwikkeloptie voor de eigenaar (die is zelf op de beta, dus de voorwaarde `CHANNEL === 'stable'` geldt dan niet), om tekst en uiterlijk te bekijken. Daarna aan voor stabiel met een PR naar `main` en `npm run release`. De webcode komt live van de site, dus er is geen nieuwe app-versie nodig. Een regel in `src/lib/changelog.ts` is niet nodig: de kaart is zelf de mededeling.

**Tests:** de voorwaarde (aantal sessies, eerste sessie, kanaal, eigenaar, weggeklikt) als losse functie met een test, zoals `exportReminder.ts`.

**Timing:** de Nationale Tuinvogeltelling (29–31 jan) brengt veel nieuwe gebruikers. De drempel van 5 sessies houdt die er grotendeels buiten; de kaart kan dus gewoon in januari aan.

## Besloten (24 nov)

- **Feedback via Discord**, zoals nu; de groep is alleen voor mededelingen. De kaart en de welkomstmail van de groep noemen Discord (link) naast Feedback in het menu.
- **Aantal:** een handjevol actieve testers is genoeg, zeg 5. Niet iedereen die lid wordt, blijft actief, dus de kaart blijft aan tot er een stuk of 8–10 lid zijn en gaat dan uit (een PR die hem uitzet, plus release). Valt het aantal actieve testers later terug, dan kan hij weer aan.
- **Gegevens meenemen zonder back-up:** niet nodig voor nu; de back-up volstaat.
- **Uitproberen met het tweede account:** na de productierelease, als de track "Beta" er is. Dat account is sinds 18 nov tester van de interne test, en daar wint de beta altijd; eerst "Programma verlaten" via de link van de interne test, de app verwijderen en Fluistervink uit productie installeren. Daarna lid worden van de groep, tester worden van "Beta" en kijken of Play de app bijwerkt of dat verwijderen nodig is. Ook nagaan: komt de back-up van stabiel goed terug in de beta.
