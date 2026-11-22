# Plan: Jaarrond Tuintelling

Voorstel van 22 nov 2026, voor na de Nationale Tuinvogeltelling (29–31 jan 2027, `docs/plan-tuintelling.md`). Pas bouwen als die telling een succes is. Het idee: de tuintelmodus met een kleine aanpassing ook gebruiken voor de Jaarrond Tuintelling van Sovon, zodat een tuinteller van januari een reden heeft om de app daarna te blijven gebruiken.

## De telling

Nagegaan op 22 nov op [Hoe werkt jaarrond tellen](https://www.tuintelling.nl/hoe-werkt-jaarrond-tellen) en [jaarrondtuintelling.nl](https://www.jaarrondtuintelling.nl/):

- Van Sovon met Vogelbescherming, De Vlinderstichting, RAVON, Zoogdiervereniging, FLORON en EIS ([Sovon](https://www.sovon.nl/tellen/telprojecten/jaarrond-tuintelling)). Het hele jaar, niet één weekend.
- **Account nodig** op jaarrondtuintelling.nl (een Sovon-account volstaat, ook inloggen met een waarnemerscode). Daar maak je **een tuin** aan: type, grootte en plek (postcode en huisnummer of een speld op de kaart). Meerdere tuinen kan.
- Twee soorten tellingen:
  - **Weektelling**: wat zat er deze week in je tuin; meerdere tellingen in één week voegt de site zelf samen. Bij voorkeur elke week invoeren.
  - **Tijdstiptelling**: een korte telling, "bijvoorbeeld 5, 10 of 15 minuten", met **begin- en eindtijd**. Telt ook mee in de weeklijst.
- Bij beide: per soort het **hoogste aantal tegelijk**, niet optellen (net als bij de Nationale Tuinvogeltelling). Geen aantal mag: dan staat de soort op "aanwezig".
- Per telling geef je per **soortgroep** aan of je die compleet telde ("Ja, compleet", "Nee / niet alles", "Nooit"). Naast vogels ook vlinders, libellen, zoogdieren, amfibieën en reptielen.
- **Overvliegers mogen wel**, met "overvliegend" erbij; alleen voor vogels zonder binding met de tuin (ganzen op trek). Jagende gierzwaluwen boven de tuin gelden als in de tuin.
- Invoeren op de website: soort aanklikken of typen, aantal, optioneel opmerking en foto, dan "klaar met invoeren". **Achteraf aan te passen** (anders dan bij Vogelbescherming). Geen import, API of tellijst gevonden; de invoerpagina zit achter de login.
- Deelnemers: niet gevonden. De toplijst van tellers telt honderden tellingen per persoon; de meest gemelde soorten in november zijn koolmees, pimpelmees, merel, vink en ekster.

## Wat er anders is dan de tuintelmodus

| | Nationale Tuinvogeltelling | Jaarrond Tuintelling |
| --- | --- | --- |
| Duur | precies een half uur | vrij: 5, 10, 15 minuten of langer (tijdstip), of los door de week |
| Overvliegers | tellen niet mee | doorgeven, met "overvliegend" |
| Soortenlijst | 25 vaste soorten, de rest toevoegen | geen vaste lijst, je zoekt per soort |
| Andere diergroepen | nee | ja, per soortgroep "compleet" of niet |
| Begin- en eindtijd | datum en begintijd | datum, begin- en eindtijd |
| Na insturen | niet te corrigeren | wel aan te passen |
| Waar | mijntuinvogeltelling.nl, zonder account | jaarrondtuintelling.nl, met account en tuin |

De kern blijft gelijk: tellen in de trektelstand, per soort het hoogste aantal, een overzicht om over te typen. Dat is de "kleine aanpassing".

## Voorstel

Eén tuintelmodus met een keuze, geen tweede modus ernaast.

1. **Duur kiezen.** Bij het starten van een tuintelling: "Half uur (Nationale Tuinvogeltelling)", of 5, 10, 15 minuten, of "Tot ik stop". De klok, de trillen (vijf minuten voor het eind alleen als de telling langer dan tien minuten duurt) en het vanzelf stoppen werken zoals nu, met de gekozen duur in plaats van `TUINTEL_MS`. In de sessie: `tuintelling: 'nationaal' | 'jaarrond'` (nu `true`, dat blijft lezen als nationaal) en `tuintelDurationMs`. Rond het telweekend van januari staat de knop voor de Nationale Tuinvogeltelling voorop (`docs/plan-tuintelling.md`, punt 12); de rest van het jaar de jaarrondtelling.
2. **Overvliegers meetellen.** `tuintelResult` krijgt een stand: bij de jaarrondtelling gaan overvliegers niet apart als "telt niet mee", maar in de lijst met "overvliegend" erachter (een soort die je zowel in de tuin als overvliegend zag: twee regels, zoals op hun formulier). Het model zet "overvliegend" al.
3. **Overzicht na afloop.** Datum, begin- en eindtijd bovenaan; dan alle soorten op naam (geen vaste 25), daarna per soortgroep een blok (vlinders, zoogdieren e.d.), zodat je ziet welke groepen je deze keer telde. Of een groep "compleet" was, weet alleen de teller; het overzicht noemt de groepen met waarnemingen en laat die keuze aan de gebruiker bij het invoeren. Kopiëren en een knop naar jaarrondtuintelling.nl in plaats van mijntuinvogeltelling.nl. Verzamelsoorten ("Mees onbekend") hoeven niet weg: hun formulier kent zelf "Meeuw spec." en dergelijke; wel nagaan welke van onze verzamelsoorten er een tegenhanger hebben.
4. **Weektelling.** Een week is in Fluistervink gewoon een paar sessies. Een knop "Deze week" bij het resultaat zet het hoogste aantal per soort over alle tuintellingen van die week (maandag tot zondag, na te gaan welke weekindeling Sovon gebruikt) op een rij. Dezelfde rekensom als nu, over meer sessies. Alleen als de proef (hieronder) laat zien dat tellers zo werken; anders weglaten, want de site voegt tijdstiptellingen zelf samen in de weeklijst.
5. **Welke tuin.** Geen tuinen in de app (geen accounts, geen adres). De sessie heeft al een GPS-plek; wie meerdere tuinen heeft, ziet aan de naam van de sessie welke het was. Niets naar Sovon.
6. **Waarneming.nl.** Blijft zoals bij elke sessie: dezelfde waarnemingen kunnen ook naar waarneming.nl. Nagaan of Sovon het erg vindt als dezelfde tuinvogels in beide terechtkomen (bij waarneming.nl zijn het losse waarnemingen, bij Sovon een telling).
7. **Model.** Geen promptwijziging verwacht: "nu vijf koolmezen" is bij beide tellingen een momentopname. Wel met de testset meten na de Nationale Tuinvogeltelling (`docs/plan-tuintelling.md`, punt 5), dan geldt de uitkomst voor beide.
8. **Kosten.** Een korte telling van 5–15 minuten in de trektelstand kost een paar cent; een vaste teller die elke dag telt, blijft ruim onder het plafond per installatie (5 uur spraak per dag).

## Uitzoeken

- **Sovon vragen**: is er een import of een link die een telling vooraf invult (net als de vraag aan de developer van Vogelbescherming, `docs/plan-tuintelling.md`, punt 4)? Welke soortnamen en verzamelsoorten kent hun formulier, en welke weekindeling? Willen ze dat tellers via een app binnenkomen, en mag de app hun naam noemen? Contact via de helpdesk van Sovon; namen niet in deze repo.
- Hoe hun invoerscherm eruitziet (na registratie met een eigen account bekijken), zodat het overzicht dezelfde volgorde en woorden gebruikt.
- Met de eigenaar: een week lang elke ochtend tien minuten tellen in de eigen tuin, en kijken of overtypen te doen is.

## Volgorde

1. Na de telling van januari: terugblik (`docs/plan-tuintelling.md`, Na de telling); besluit of dit doorgaat.
2. Sovon benaderen, met de cijfers van januari als argument.
3. Bouwen achter de ontwikkeloptie `tuintelling`: duur kiezen, overvliegers, overzicht, knop naar jaarrondtuintelling.nl (punt 1–3). Klein: vooral `tuintelling.ts` en `TuintelResult.svelte`, plus de keuze bij het starten (`Home.svelte`).
4. Proef van een week (hierboven), dan eventueel de weektelling (punt 4).
5. Voor iedereen; in de uitnodiging na de Nationale Tuinvogeltelling ("blijf tellen in je tuin").

## Wat niet

- Geen account bij Sovon in de app, geen inloggen namens de gebruiker, geen formulieren insturen.
- Geen tuinbeheer (type, grootte) in de app; dat staat bij Sovon.
- Geen andere evenementtellingen van tuintelling.nl (Tuinvlindertelling, Egeltelling) in dit plan; die kunnen later met dezelfde knop als de jaarrondtelling.

## Open beslissingen voor de eigenaar

- Doorgaan na januari, en Sovon vooraf benaderen?
- Is de weektelling (punt 4) nodig, of volstaat een tijdstiptelling per sessie?
