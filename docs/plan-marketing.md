# Plan: Fluistervink bekend maken

Voorstel van 22 nov 2026, nog niet besloten. Hoe Fluistervink gebruikers vindt zodra de app openbaar in Google Play staat (`docs/lancering.md`). De promotie rond de tuintelling staat apart in `docs/plan-tuintelling.md` (Promotie); dit plan is het kader eromheen: wanneer, voor wie, via welke kanalen en wat we meten.

## Uitgangspunt: elke gebruiker kost geld

Elke uitspraak gaat naar OpenAI en Anthropic, en er is nog geen betaalde laag (`docs/roadmap.md`, punt 6). Meer gebruikers betekent dus meteen hogere kosten, en een plotselinge piek kan het plafond bij de aanbieders raken, waarna de app voor iedereen stopt. Daarom:

- **Groeien in stappen**, niet zo groot mogelijk. Na elke stap de kosten per actieve gebruiker (Developer) en het aantal dat terugkomt (Statistieken) bekijken voordat de volgende stap komt.
- **Vóór elke push** de plafonds nalopen: per installatie in de proxy (`docs/proxy.md`) en bij OpenAI en Anthropic.
- **Geen betaalde advertenties.** De doelgroep is klein en via verenigingen en media goed te bereiken; gekochte installaties blijven zelden en kosten dubbel (advertentie plus verbruik).
- **Alleen Nederland en België** (`docs/roadmap.md`, Kader: landen en talen). Geen reclame in andere landen of talen.

## Doelgroep

Recreatieve vogelaars in Nederland en België die waarneming.nl of waarnemingen.be gebruiken of willen gebruiken, en die tijdens het vogelen niet willen typen. Daarnaast, rond de tuintelling, tuintellers die geen vogelaar zijn: een instap die later kan uitgroeien tot wandelen met de app.

## Het verhaal

- **In één zin:** "Fluister je vogels in, je handen blijven bij de verrekijker, en thuis staat alles klaar voor waarneming.nl."
- **Het herkenbare probleem:** de verrekijker loslaten om te typen en de vogel kwijt zijn, of thuis niet meer weten hoeveel het er waren en waar.
- **De naam:** "luistervink", maar dan fluisteren; de vink is de vogel die je het vaakst inspreekt. Eén keer uitleggen, dan blijft hij hangen.
- **Laten zien, niet vertellen:** een filmpje van 20 à 30 seconden (verrekijker voor de ogen, "Fluistervink, drie putters", trillen, de waarneming in de lijst). Spraak doet het ook goed op de radio.
- **De easter eggs** (#tocheenbuizerd, lifer; `src/lib/eastereggs.svelte.ts`) zijn grappen onder vogelaars en worden gedeeld. Laten ontdekken, niet aankondigen.
- **Eerlijk over de grenzen:** Android-app, op de iPhone als webapp in Safari (zonder trillen); geen account nodig.

## Fasen

| Wanneer | Fase | Wat |
| --- | --- | --- |
| begin dec | zachte lancering | openbaar in Play; testers om een recensie vragen; voorpagina met de Play-link (`docs/lancering.md`, punt 5); bericht in eigen kring, Discord van de testers, een paar vogelgroepen |
| dec | meten | kosten per actieve gebruiker, terugkeer na een week; winkelpagina en filmpje afmaken |
| jan | eerste grote push | nieuw logo en de Nationale Tuinvogeltelling (29–31 jan), zie `docs/plan-tuintelling.md` |
| feb | terugblik | wat bleef hangen na de telling; besluit over de volgende stap en over de betaalde laag |
| voorjaar | broedseizoen | vogelwerkgroepen en clubavonden: wandelen met de app |
| okt | trek | EuroBirdwatch (begin okt) en de trektelmodus; goed moment voor de betaalde laag |

## Kanalen

Op volgorde van wat ze waarschijnlijk opleveren tegen wat ze kosten.

1. **Vogelbescherming:** de tuintelling, hun nieuwsbrief, sociale media en het blad *Vogels*. Gesprekken in de week van 23 nov (`docs/plan-tuintelling.md`, punt 4); daar ook vragen of ze Fluistervink buiten de telling willen noemen.
2. **Vroege Vogels** (BNNVARA, radio en tv): precies de doelgroep, en een app waarin je vogels influistert is een verhaal voor de radio. Een kort bericht met het filmpje.
3. **waarneming.nl en waarnemingen.be:** de export naar hun bulkimport levert hun meer en betere meldingen op. Vragen of ze het willen noemen (nieuws of forum), zonder te suggereren dat het hun app is.
4. **Natuurpunt** (België): beheert waarnemingen.be en het Grote Vogelweekend (30–31 jan 2027).
5. **Vogelwerkgroepen, IVN en KNNV-afdelingen:** een mail aan de secretaris, een stukje in het ledenblad (deadline vaak weken vooraf), een demo op een clubavond. Klein, maar deze mensen praten het door.
6. **Facebookgroepen en fora over vogels:** een bericht met het filmpje, liefst door een tester die de app zelf gebruikt.
7. **Regionale pers en techsites:** het verhaal van één maker die met AI een vogelapp bouwt; regionale kranten zoeken rond de tuintelling lokale tellers.

## Winkelpagina in Play

De teksten staan in `docs/play-store/README.md`; daar ook bijwerken als hier iets besloten wordt.

- **Titel** (max. 30 tekens): een zoekwoord erbij, bijvoorbeeld "Fluistervink: vogels inspreken". Op "Fluistervink" zoekt nog niemand. Mag pas als de naam in Play al zo heet.
- **Korte beschrijving** (nu "Spreek je vogelwaarnemingen in en zet ze thuis op waarneming.nl."): "waarneming.nl" en "inspreken" staan er al in; eventueel "handen vrij" of "verrekijker" erbij.
- **Lange beschrijving:** Google zoekt ook daarin. Woorden die vogelaars typen: vogels, vogelaar, waarnemingen, waarneming.nl, tellen, tuintelling, trektellen, spraak.
- **Promotievideo** (YouTube-link in de winkelvermelding): het filmpje uit Het verhaal. Opnemen kan samen met de draaiboeken voor buiten (`docs/draaiboek-buiten.md`).
- **Schermafbeeldingen:** opnieuw met het nieuwe logo (`npm run play-screenshots`); in januari een over de tuintelling.
- **Recensies:** de testers bij de lancering vragen om een eerlijke recensie; de eerste paar bepalen de indruk. Nooit iets aanbieden in ruil voor een recensie (regel van Google). Later eventueel de in-app review van Google (native, nieuwe app-versie), alleen na een geslaagde sessie en hooguit eens per paar maanden.

## Meten

- **Per kanaal een eigen link** naar Play met een `referrer` (`https://play.google.com/store/apps/details?id=nl.hegmus.fluistervink&referrer=utm_source%3Dvroegevogels`); de Play Console toont installaties per bron. De app leest de referrer niet uit, dus `#privacy` hoeft niet mee.
- **Wat telt** (`docs/roadmap.md`, Signalen): hoeveel gebruikers na een maand of twee nog wekelijks vogelen, en de kosten per actieve gebruiker. Het aantal installaties zegt weinig.
- **Alleen totalen** uit Statistieken en Developer, zoals nu.

## Bewust niet

- Betaalde advertenties (zie Uitgangspunt).
- Reclame buiten Nederland en België of in het Engels.
- Een grote lancering in december: weinig vogelen, nog geen logo, en de tuintelling in januari is een betere aanleiding.
- De naam of het logo van Vogelbescherming, waarneming.nl of Natuurpunt gebruiken zonder hun akkoord.

## Open beslissingen

1. Titel in Play met een zoekwoord, of alleen "Fluistervink"?
2. Wie maakt het filmpje, en wie spreekt in (de eigenaar of een tester)?
3. Wanneer de eerste stap buiten de eigen kring: begin december of pas in januari met de tuintelling?
4. Welke stap moet de kosten bewijzen voordat de volgende komt: een bedrag per actieve gebruiker per maand vooraf afspreken.
