# Plan: Nationale Tuinvogeltelling

Voorstel van 20 nov 2026. Uitzoekwerk gedaan op 20 nov; op 21 nov de kern gebouwd als ontwikkeloptie `tuintelling` (zie Gebouwd, onderaan). Voortgekomen uit het idee "Aanhaken bij telmomenten" (`docs/ideeen.md`, 12 nov). Twee doelen: een tuintelling met Fluistervink moet makkelijker zijn dan met pen en papier, en de telling is het moment om nieuwe gebruikers te werven.

## De telling

Nagegaan op 20 nov bij Vogelbescherming zelf ([tuinvogeltelling](https://www.vogelbescherming.nl/tuinvogeltelling), [hoe werkt het](https://www.vogelbescherming.nl/tuinvogeltelling/hoe-werkt-het), [veelgestelde vragen](https://www.vogelbescherming.nl/tuinvogeltelling/veel-gestelde-vragen)):

- **Vrijdag 29 t/m zondag 31 januari 2027** (bevestigd op de site van Vogelbescherming). Vrijdag is ook de scholenteldag.
- Je telt **één keer een half uur** in je tuin of op je balkon.
- Per soort geef je het **hoogste aantal dat je tegelijk zag** op (eerst 3 koolmezen, later 5 tegelijk: je geeft 5 op).
- Vogels die **alleen overvliegen tellen niet mee**.
- Voor- en achtertuin samen mag: ook dan het hoogste aantal tegelijk, niet optellen. Mannetjes en vrouwtjes samen in één vakje.
- Alleen wat je in dat half uur écht zag ("je merel" die er nu niet is, telt niet). Weinig of geen vogels doorgeven is ook nuttig.
- Een ingestuurde telling is **niet te corrigeren**; een vergeten vogel stuur je los in als nieuwe telling met alleen die soort.
- Invoeren via de web-app **mijntuinvogeltelling.nl** van Vogelbescherming, van vrijdagochtend tot maandag 12:00.
- In 2026 **136.903 deelnemers** en 1,9 miljoen vogels; de koolmees werd voor het eerst nummer één (de huismus was dat 23 jaar). Organisatie door Vogelbescherming, met Sovon; veel aandacht in de media (Vroege Vogels, regionale omroepen, lokale kranten).

Ook in België is het vogelweekend (Natuurpunt, Het Grote Vogelweekend) op 30–31 januari 2027; buiten de scope van dit plan (`docs/roadmap.md`, Kader: landen en talen), wel goed om te weten voor Vlaamse gebruikers.

Eerdere bronnen: RODI over de telling van [2026](https://www.rodi.nl/dijkenwaard/nieuws/481392/doe-mee-aan-de-nationale-tuinvogeltelling-2026) en [2025](https://www.rodi.nl/haarlem/nieuws/427192/de-nationale-tuinvogeltelling-2025), [Vroege Vogels over 2025](https://www.bnnvara.nl/vroegevogels/artikelen/ruim-100000-mensen-tellen-1-miljoen-vogels-tuinvogeltelling-2025).

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

### Bij de telling (uitgezocht 20 nov)

1. **Data en regels 2027**: gedaan, zie De telling hierboven. Datums bevestigd, regels gelijk aan 2026.
2. **Invoer bij Vogelbescherming**: **geen import, geen API, geen link met soorten erin.** Uit de openbare code van de web-app (Angular, `mijntuinvogeltelling.vogelbescherming.nl`): het formulier stuurt één JSON-object naar hun eigen gateway, met:
   - wie: voornaam, achternaam, e-mailadres (verplicht), eventueel telefoon; nieuwsbrief;
   - waar: **postcode en huisnummer** (geen GPS; hun database koppelt de telling aan het adres), woonadres of ander adres, tuin of balkon;
   - wanneer: **datum en begintijd** van het half uur (alleen de drie teldagen);
   - wie telde: aantal tellers, en hoe ervaren ("een beginnende vogelaar" e.d.);
   - per soort een aantal, met een eigen soort-ID; ze controleren zelf op verdachte aantallen.

   Een telling vooraf invullen via de URL kan niet (de app leest alleen parameters voor inloggen en een campagnecode). Zelf naar hun gateway posten doen we niet: niet bedoeld voor anderen, en het zou namens de gebruiker een formulier insturen. **Dus: overtypen**, en ons overzicht moet dat zo makkelijk mogelijk maken. Het formulier toont eerst vaste soorten, de rest via "vogelsoort toevoegen". De papieren [tellijst](https://www.vogelbescherming.nl/docs/c9f893fb-55b7-4d7c-87b6-7fe0626bbd3a.pdf) heeft 25 soorten op alfabet: Boomklever, Boomkruiper, Ekster, Gaai, Groenling, Grote bonte specht, Halsbandparkiet, Heggenmus, Houtduif, Huismus, Kauw, Koolmees, Koperwiek, Kramsvogel, Merel, Pimpelmees, Roodborst, Spreeuw, Staartmees, Stadsduif, Turkse tortel, Vink, Winterkoning, Zanglijster, Zwarte kraai. Alle 25 staan met dezelfde naam in onze lijst (`data/soorten-nl.json`, alleen hoofdletters anders). Het formulier gaat pas in januari open; dan nog nagaan of de volgorde in de web-app gelijk is aan de tellijst.
3. **Waarneming.nl**: geen koppeling gevonden; de tuintelling loopt alleen via Vogelbescherming, en niemand beschrijft dat je hem ook bij waarneming.nl invoert. Dus: de sessie blijft een gewone sessie die je óók naar waarneming.nl kunt exporteren (met overvliegers, elke waarneming los, zoals nu); het tuintelresultaat is een apart overzicht. Geen extra exportvorm nodig.
4. **Houding van Vogelbescherming**: niets openbaars over andere apps bij de telling. Wel: ze hebben een eigen web-app met quiz, herkennen en vogelgids, en die app kent een verwijzingscode (`referralCode`) en campagnes van partners (een vlag "intratuinactie"). Ze werken dus met partners en kunnen meten wie via wie binnenkomt. Dat maakt een vriendelijke vraag kansrijker dan zwijgend ernaast staan: Fluistervink stuurt tellers naar hún formulier, en kan hun verwijzingscode meegeven in de link als ze dat willen. Positie: aanvulling ("tel met je stem, voer in bij Vogelbescherming"), geen concurrent; geen logo of huisstijl, niet de indruk wekken dat het een officiële app is.

   **Contact (20 nov):** de eigenaar kent mensen bij Vogelbescherming. De lead merk & campagnes is gemaild (vraag: bij wie moet ik zijn voor een tuintelmodus). In de week van 23 nov gesprekken met de social media manager en een developer. Namen staan bewust niet in deze (openbare) repo.

   - **Developer:** de grootste winst is een link die het formulier vooraf invult (soort-ID's en aantallen in de URL; adres, e-mail en insturen blijven bij de gebruiker). Verder: de soort-ID's en de volgorde van de vaste soorten in 2027, of er een testomgeving is, en of een verwijzingscode voor Fluistervink kan.
   - **Social media manager:** of en hoe ze Fluistervink willen noemen (bericht, filmpje, de week ervoor), welke woorden wel en niet, #tuinvogeltelling, en wanneer hun planning voor januari vastligt.

### In de app

5. **Wat een aantal betekent.** Bij de tuintelling betekent "vijf koolmezen" *nu vijf tegelijk*, niet *vijf erbij*. De belangrijkste ontwerpkeuze. Voorstel: de uitspraken blijven gewone waarnemingen (zodat nalopen, kaart en export werken), en het tuintelresultaat rekent per soort het **maximum** over de waarnemingen van die soort. Open vragen:
   - Wat doen "nog drie erbij" en "die laatste weg" dan? (Waarschijnlijk zoals nu: ze passen één waarneming aan, het maximum volgt vanzelf.)
   - Moet het model weten dat het een tuintelling is? Bv. "weer twee merels" is dan geen correctie op de vorige maar een nieuwe momentopname. Met de testset meten, liefst zonder promptwijziging; anders een korte regel in beide prompts (`prompt.ts`, `promptEn.ts`).
   - Wat gaat er mee naar waarneming.nl: elke waarneming los (zoals nu), of één per soort met het maximum?
6. **Overvliegers**: blijven in de lijst (het model zet al "overvliegend"), maar tellen niet mee in het tuintelresultaat, met een korte uitleg in het overzicht ("3 overvliegend, telt niet mee").
7. **Half uur**: het half uur begint pas als je begint met tellen (knop "Begin met tellen"), niet bij het starten van de sessie: wie de telefoon klaarzet, begint vaak pas bij de eerste vogel (proeftelling 22 nov). Een zichtbare klok, een tril (en de gesproken bevestiging, als die aanstaat) bij 5 minuten voor het eind en bij het eind. Daarna stopt de telling en de sessie vanzelf; wat nog in de wachtrij zit, wordt gewoon verwerkt. De klok loopt op de wandklok, ook als je even stopt met luisteren.
8. **Overzicht na afloop**: bovenaan datum en begintijd (die vraagt het formulier), dan de 25 soorten van het formulier op alfabet met het hoogste aantal (alleen die je zag), daarna de rest ("via vogelsoort toevoegen"). Een knop Kopiëren en een link naar mijntuinvogeltelling.nl. Omdat een ingestuurde telling niet te corrigeren is, is dit het moment om te controleren: onzekere waarnemingen eerst nalopen, en een "onbekend" (Mees onbekend, Duif onbekend; die staan in onze lijst) kan niet in hun formulier, dus vraagt het overzicht om een soort te kiezen of hem weg te laten. Aantal tellers en adres vult de gebruiker zelf in bij Vogelbescherming; Fluistervink stuurt niets naar hen.
9. **Hoe je inspreekt**: besloten na de proeftelling van 22 nov: **doorlopend, in de trektelstand** (telefoon op de vensterbank, elke minuut een stuk). Met de knop hield de eigenaar de opname minutenlang open (wachten op de vogel), en dan maakte de regel voor een per ongeluk gemaakte opname alles onzeker. Zonder trektelstand (oude browser) de gewone knop; het half uur begint dan bij de eerste opname. Nog meten: hoeveel huiskamergeluid (kinderen, tv, radio) binnenkomt, en wat het kost (punt 13).
10. **Soorten en woorden van beginners**: de tuinvogels staan allemaal in de lijst, plus Mees, Mus, Duif, Kraai en Specht "onbekend". De prompt zegt al dat bijnamen ook als verkleinwoord gelden ("twee pimmetjes"). Wel nalopen met de testset: "mus" (huismus of ringmus), "mees", "kraai", "duif", "specht", "roodborstje", "pimpelmeesje", "ekster" en "spreeuw" in de verkleinvorm en in het meervoud. Bij twijfel liever onzeker met kandidaten dan een gok.
11. **Nieuwelingen**: voor velen wordt dit de eerste keer. Het welkom moet een tuinteller zonder omweg naar "Tuintelling starten" brengen, en Probeer het eens moet werken met alleen "een merel".
12. **Waar de knop staat**: tijdens het telweekend een duidelijke knop "Tuintelling" op het startscherm, daarbuiten weg (of onder Instellingen). Zo hoeft er niets permanent bij.

### Kosten en capaciteit

13. **Piek in één weekend.** Een paar honderd tot duizend tellers met Fluistervink is denkbaar. Een half uur doorlopend luisteren kost grofweg $0,15–0,20 per teller (spraakherkenning ~$0,0045 per minuut, gemeten bij de trektelling van 19 nov, plus het model); met de knop veel minder. Bij 1000 tellers dus tot ~$200. Vóór de telling: de plafonds bij OpenAI en Anthropic voor het weekend ophogen, de daglimiet per installatie laat een half uur ruim toe (nagegaan 20 nov: 5 uur spraak en 1500 modelverzoeken per dag, 60 verzoeken per minuut, `worker/index.ts` en `wrangler.jsonc`; aanmelden ook 60 per minuut per IP-adres, krap alleen als een hele klas achter één IP-adres tegelijk installeert), en een duidelijke melding als een plafond bereikt is. Ook aanmelden (Play Integrity, Turnstile) onder piekbelasting nalopen.
14. **Delen met de ontwikkelaar**: honderden gedeelde sessies in één weekend zijn waardevol voor de testset (veel nieuwe sprekers, huiskamergeluid), maar ook veel. Opnames alleen als de gebruiker dat apart aanzet, zoals nu; de opslag in de proxy nagaan.
15. **Privacy**: als er cijfers naar buiten gaan (Promotie, terugblik), alleen totalen van gedeelde sessies, en `#privacy` noemt dat.

## Promotie

### Het verhaal

"Fluister je tuintelling in": je ogen blijven bij het raam, je handen bij de verrekijker en de koffie, en na een half uur staat het lijstje klaar om in te voeren. Geen account en geen e-mailadres nodig. Dat past bij de tuintellers, die vaak geen vogelaar zijn.

### Waar het staat

- **Pagina `fluistervink.nl/tuintelling`** (opzet 21 nov: `public/tuintelling.html`, met `noindex` tot de tuintelmodus voor iedereen is; de naam Vogelbescherming pas na hun akkoord; het filmpje nog niet): in drie stappen hoe het werkt, een filmpje van 30 seconden bij het raam, de link naar Play en voor iPhone de PWA in Safari (voor een telling thuis mist alleen het trillen). Dit is de link in alle berichten.
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
- Een uitnodiging in de app na de telling: "Probeer het ook eens op een wandeling", of: blijf tellen in je tuin met de Jaarrond Tuintelling (`docs/plan-jaarrond-tuintelling.md`). Zo wordt de tuintelling een instap en geen eenmalig gebruik.
- Meten wat bleef hangen: hoeveel installaties van het telweekend in februari nog een sessie starten (Statistieken, alleen totalen).

## Wat niet

- Geen officiële samenwerking veronderstellen, geen logo of huisstijl van Vogelbescherming.
- Niet automatisch invoeren bij mijntuinvogeltelling.nl als er geen import of API is (geen formulieren invullen namens de gebruiker).
- Geen pushberichten of e-mail (er zijn geen accounts).

## Open beslissingen voor de eigenaar

- Gaat de tuintelling door als de app half januari nog niet openbaar in Play staat (alleen de PWA)?
- Vogelbescherming vooraf benaderen?
- Budget voor het telweekend (plafonds).

## Gebouwd (21 nov, ontwikkeloptie `tuintelling`)

- Knop "Tuintelling: een half uur tellen" op het startscherm (`Home.svelte`), alleen met de ontwikkeloptie. De sessie krijgt `tuintelling: true` (`db.ts`, `sessions.ts`).
- Tellen in de trektelstand (22 nov, na de proeftelling): onderaan één knop "Begin met tellen"; de microfoon blijft aan en knipt per minuut, zoals de trektelling (`ActiveSession.svelte`). Daar begint het half uur (`tuintelStartedAt`, `startTuintelCount` en `tuintelPhase` in `tuintelling.ts`). Stop je het luisteren, dan "Verder luisteren"; de klok loopt door. Zonder trektelstand de gewone knop, en dan begint het half uur bij de eerste opname.
- In de kop een klok die aftelt; bij nog vijf minuten twee middellange trillen, na het half uur drie lange en stoppen de telling en de sessie vanzelf, met het eind van het half uur als eindtijd (`App.svelte`, `feedback.ts`). Staat de app op de achtergrond en loopt de klok niet, dan stopt hij bij terugkomen.
- Na afloop "Nog iets vergeten?" in het resultaat (22 nov): "Nog iets inspreken" zet de sessie voort met de gewone knop, zonder klok; in de kop "Nog iets vergeten? Spreek het in en tik op Klaar", en Klaar (zonder vraag) gaat terug naar het resultaat. Het telt gewoon mee in het hoogste aantal.
- Bij de sessie de kaart Tuintelling (`TuintelResult.svelte`, `tuintelling.ts`) in plaats van de samenvatting: datum en begintijd (van het tellen), de vaste soorten van het formulier in hun volgorde met het hoogste aantal, daarna "zelf toevoegen", verzamelsoorten als waarschuwing, overvliegers apart (tellen niet mee), Kopiëren en een knop naar het telformulier. Andere dieren en uitgevinkte waarnemingen tellen niet mee.
- Nog niet: het model weet niet dat het een tuintelling is (punt 5, eerst meten); welkom en uitleg (punt 11); de knop alleen rond het telweekend (punt 12).
