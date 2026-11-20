# Plan: Nationale Tuinvogeltelling

Voorstel van 20 nov 2026, nog niet goedgekeurd. Voortgekomen uit het idee "Aanhaken bij telmomenten" (`docs/ideeen.md`, 12 nov). Twee doelen: een tuintelling met Fluistervink moet makkelijker zijn dan met pen en papier, en de telling is het moment om nieuwe gebruikers te werven.

## De telling

Bekend uit eerdere edities (2025: 24–26 jan, 2026: 30 jan–1 feb); de editie van 2027 is nog niet aangekondigd:

- Vermoedelijk **vrijdag 29 t/m zondag 31 januari 2027** (laatste weekend van januari; nog bevestigen).
- Je telt **één keer een half uur** in je tuin of op je balkon.
- Per soort geef je het **hoogste aantal dat je tegelijk zag** op (eerst 3 koolmezen, later 5 tegelijk: je geeft 5 op).
- Vogels die **alleen overvliegen tellen niet mee**.
- Invoeren via de web-app **mijntuinvogeltelling.nl** van Vogelbescherming, van vrijdagochtend tot maandag 12:00.
- Ruim 100.000 deelnemers per jaar, veel aandacht in de media (Vroege Vogels, regionale omroepen, lokale kranten).

Bronnen: RODI over de telling van [2026](https://www.rodi.nl/dijkenwaard/nieuws/481392/doe-mee-aan-de-nationale-tuinvogeltelling-2026) en [2025](https://www.rodi.nl/haarlem/nieuws/427192/de-nationale-tuinvogeltelling-2025), [Vroege Vogels over 2025](https://www.bnnvara.nl/vroegevogels/artikelen/ruim-100000-mensen-tellen-1-miljoen-vogels-tuinvogeltelling-2025).

## Tijdlijn

Krap, want de telling valt vlak na de lancering in Play (`docs/lancering.md`, productietoegang aanvragen rond 1 dec).

| Wanneer | Wat |
| --- | --- |
| eind nov – half dec | uitzoeken (hieronder), besluit over de telmodus |
| half dec – begin jan | bouwen achter een ontwikkeloptie, proeven bij het raam |
| begin jan | voor iedereen; pagina en filmpje klaar; pers en clubs benaderen |
| ~22 jan | berichten de deur uit; plafonds bij OpenAI, Anthropic en de proxy nagelopen |
| 29–31 jan | de telling; melding in de app op vrijdag |
| feb | terugblik, cijfers, wat bleef hangen |

Voorwaarde: Fluistervink staat half januari openbaar in Play. Lukt dat niet, dan alleen de PWA (zie Promotie).

## Uitzoeken

### Bij de telling

1. **Data en regels 2027**: officiële datums, en of de regels gelijk blijven (tuin en balkon, half uur, overvliegers niet).
2. **Invoer bij Vogelbescherming**: heeft mijntuinvogeltelling.nl een import, een API of een link met de soorten erin? Waarschijnlijk niet. Dan een overzicht in de volgorde en met de namen van hun formulier, zodat overtypen in een minuut kan. Daarvoor hun soortenlijst en de volgorde ophalen (zonder in te loggen: eventueel een proefinvoer door de eigenaar).
3. **Waarneming.nl**: wat doen vogelaars daar met hun tuintelling (een gewone lijst, een project, niets)? Bepaalt of de gewone export erbij hoort, en of overvliegers dan wel mee mogen (bij waarneming.nl wel, bij de tuintelling niet).
4. **Houding van Vogelbescherming**: ziet de organisatie een app die "voor" hun telling werkt als hulp of als concurrent van de eigen app? Bepaalt of we ze vooraf benaderen (en hoe), en welke woorden we mogen gebruiken. Geen logo of huisstijl van Vogelbescherming gebruiken, en niet de indruk wekken dat het een officiële app is.

### In de app

5. **Wat een aantal betekent.** Bij de tuintelling betekent "vijf koolmezen" *nu vijf tegelijk*, niet *vijf erbij*. De belangrijkste ontwerpkeuze. Voorstel: de uitspraken blijven gewone waarnemingen (zodat nalopen, kaart en export werken), en het tuintelresultaat rekent per soort het **maximum** over de waarnemingen van die soort. Open vragen:
   - Wat doen "nog drie erbij" en "die laatste weg" dan? (Waarschijnlijk zoals nu: ze passen één waarneming aan, het maximum volgt vanzelf.)
   - Moet het model weten dat het een tuintelling is? Bv. "weer twee merels" is dan geen correctie op de vorige maar een nieuwe momentopname. Met de testset meten, liefst zonder promptwijziging; anders een korte regel in beide prompts (`prompt.ts`, `promptEn.ts`).
   - Wat gaat er mee naar waarneming.nl: elke waarneming los (zoals nu), of één per soort met het maximum?
6. **Overvliegers**: blijven in de lijst (het model zet al "overvliegend"), maar tellen niet mee in het tuintelresultaat, met een korte uitleg in het overzicht ("3 overvliegend, telt niet mee").
7. **Half uur**: bij het starten van een tuintelling loopt een timer van 30 minuten, zichtbaar en met een tril (en de gesproken bevestiging, als die aanstaat) bij 5 minuten voor het eind en bij het eind. Daarna stopt de sessie vanzelf; wat nog in de wachtrij zit, wordt gewoon verwerkt.
8. **Overzicht na afloop**: per soort het hoogste aantal, in de volgorde van het formulier, met een knop Kopiëren en een link naar mijntuinvogeltelling.nl. Onzekere waarnemingen eerst nalopen (zoals nu), anders tellen ze mee met een merkteken.
9. **Hoe je inspreekt**: de knop, of de microfoon steeds aan zoals bij de trektelling (telefoon op de vensterbank). Doorlopend luisteren is makkelijk maar vangt in een huiskamer veel op (kinderen, tv, radio) en kost meer. Meten met een paar proeftellingen bij het raam, met en zonder huisgenoten. Voorlopig: de knop als standaard, doorlopend als keuze.
10. **Soorten en woorden van beginners**: de tuinvogels staan allemaal in de lijst. Wel nalopen met de testset: "mus" (huismus of ringmus), "mees", "kraai", "duif", "specht", "roodborstje", "pimpelmeesje", "ekster" en "spreeuw" in de verkleinvorm en in het meervoud. Bij twijfel liever onzeker met kandidaten dan een gok.
11. **Nieuwelingen**: voor velen wordt dit de eerste keer. Het welkom moet een tuinteller zonder omweg naar "Tuintelling starten" brengen, en Probeer het eens moet werken met alleen "een merel".
12. **Waar de knop staat**: tijdens het telweekend een duidelijke knop "Tuintelling" op het startscherm, daarbuiten weg (of onder Instellingen). Zo hoeft er niets permanent bij.

### Kosten en capaciteit

13. **Piek in één weekend.** Een paar honderd tot duizend tellers met Fluistervink is denkbaar. Een half uur doorlopend luisteren kost grofweg $0,15–0,20 per teller (spraakherkenning ~$0,0045 per minuut, gemeten bij de trektelling van 19 nov, plus het model); met de knop veel minder. Bij 1000 tellers dus tot ~$200. Vóór de telling: de plafonds bij OpenAI en Anthropic voor het weekend ophogen, nagaan of de daglimiet per installatie (`worker/index.ts`) een half uur ruim toelaat, en een duidelijke melding als een plafond bereikt is. Ook aanmelden (Play Integrity, Turnstile) onder piekbelasting nalopen.
14. **Delen met de ontwikkelaar**: honderden gedeelde sessies in één weekend zijn waardevol voor de testset (veel nieuwe sprekers, huiskamergeluid), maar ook veel. Opnames alleen als de gebruiker dat apart aanzet, zoals nu; de opslag in de proxy nagaan.
15. **Privacy**: als er cijfers naar buiten gaan (Promotie, terugblik), alleen totalen van gedeelde sessies, en `#privacy` noemt dat.

## Promotie

### Het verhaal

"Fluister je tuintelling in": je ogen blijven bij het raam, je handen bij de verrekijker en de koffie, en na een half uur staat het lijstje klaar om in te voeren. Geen account en geen e-mailadres nodig. Dat past bij de tuintellers, die vaak geen vogelaar zijn.

### Waar het staat

- **Pagina `fluistervink.nl/tuintelling`**: in drie stappen hoe het werkt, een filmpje van 30 seconden bij het raam, de link naar Play en voor iPhone de PWA in Safari (voor een telling thuis mist alleen het trillen). Dit is de link in alle berichten.
- **Play-vermelding**: in januari een zin en een schermafbeelding over de tuintelling (`docs/play-store/README.md`).
- **In de app**: op vrijdag van het telweekend een melding "Dit weekend is de tuintelling" (alleen in de app, geen pushbericht nodig).

### Kanalen

- **Vroege Vogels** (BNNVARA): besteedt elk jaar aandacht aan de telling en vindt nieuwe dingen leuk. Een kort bericht met het filmpje, begin januari.
- **Regionale omroepen en lokale kranten** (RODI e.d.): schrijven rond de telling stukjes, vaak met een lokale teller. De eigenaar als lokale teller met een app.
- **Vogelwerkgroepen, IVN, KNNV-afdelingen**: nieuwsbrief of ledenblad, vaak met een deadline weken vooraf.
- **Forum van waarneming.nl, Discord van de testers, eigen netwerk.**
- **Vogelbescherming zelf**: afhankelijk van punt 4.

### Na de telling

- Een terugblik: hoeveel tellers met Fluistervink, de meest getelde soort, iets opvallends; alleen totalen (punt 15).
- Een uitnodiging in de app na de telling: "Probeer het ook eens op een wandeling". Zo wordt de tuintelling een instap en geen eenmalig gebruik.
- Meten wat bleef hangen: hoeveel installaties van het telweekend in februari nog een sessie starten (Statistieken, alleen totalen).

## Wat niet

- Geen officiële samenwerking veronderstellen, geen logo of huisstijl van Vogelbescherming.
- Niet automatisch invoeren bij mijntuinvogeltelling.nl als er geen import of API is (geen formulieren invullen namens de gebruiker).
- Geen pushberichten of e-mail (er zijn geen accounts).

## Open beslissingen voor de eigenaar

- Gaat de tuintelling door als de app half januari nog niet openbaar in Play staat (alleen de PWA)?
- Doorlopend luisteren in de tuintelling, of alleen de knop?
- Vogelbescherming vooraf benaderen?
- Budget voor het telweekend (plafonds).
