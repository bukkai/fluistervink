# Roadmap: de Android-app na Terschelling

Voorstel van 11 nov 2026, dezelfde dag goedgekeurd (besluiten onderaan). Bundelt de ideeën voor de native laag die sinds oktober op verschillende plekken staan (`docs/plan-capacitor.md` fase 3, `docs/plan-trektelmodus.md`, de lijst "Voorstellen van Claude" en de roadmap naar v1.0 (nu `docs/roadmap.md`)) en zet ze in een volgorde. Loopt naast de lancering in Play (`docs/lancering.md`), en houdt die niet op.

## Rode draad

Alles hieronder dient één doel: **vogelen zonder naar de telefoon te kijken.** Fase 1 en 2 van de native laag hebben de terugweg geregeld (trillen met het scherm uit). De heenweg nog niet: een opname starten vraagt nog steeds het scherm, en wat de app ervan maakte, weet je pas als je kijkt.

Drie sleutels:

1. **Starten zonder scherm:** een fysieke knop, later het wake word.
2. **Opnemen met het scherm uit:** de service neemt zelf op (fase 3 van het Capacitor-plan). Dit is de voorwaarde voor bijna alles in stap 3 en 4 hieronder.
3. **Horen wat er is opgeslagen:** een korte gesproken bevestiging in de oortjes.

## Stap 1: fysieke knop met het scherm aan (klein, nu te doen)

**Volumeknop als inspreekknop.** Tijdens een sessie, met de app op het scherm, start de volumeknop een opname (zoals de knop onderaan). Native is dat een paar regels in `MainActivity.java` (de toets onderscheppen en als gebeurtenis aan de webcode geven), plus een instelling. Geen fase 3 nodig.

- Werkt met handschoenen en zonder te kijken waar de knop zit.
- **Bonus: Bluetooth-sluiterknopjes** (de selfie-afstandsbedieningen van een paar euro) sturen precies zo'n volumetoets. Daarmee heb je meteen een knop aan je verrekijkerriem of stuur, zonder extra code. Eerst eentje proberen.
- Buiten een sessie doet de volumeknop gewoon het volume.

Besloten: **tikken** om te starten en te stoppen (zie onderaan). Veel sluiterknopjes sturen bij ingedrukt houden geen lange toets maar herhaalde tikken, dus dat past ook.

**Snel starten.** Een snelkoppeling "Begin met vogelen" (lang drukken op het app-pictogram) en eventueel een tegel in de snelle instellingen. Klein, en het scheelt het zoeken naar de startknop met de verrekijker in de hand.

Native wijziging, dus een nieuwe tag; dat mag tijdens de gesloten test (de teller hoort bij de testers, niet bij de versie).

## Stap 2: gesproken bevestiging (optioneel, instelling)

De tril zegt *dat* iets is opgeslagen, niet *wat*. Met de tekst-naar-spraak van Android (geen API, geen kosten) zegt de app na het verwerken kort wat hij heeft vastgelegd: "drie houtduiven, overvliegend". Dan kun je in het veld meteen corrigeren ("nee, holenduiven") zonder te kijken.

- Alleen als er oortjes of een headset aan staan, of als je hem expliciet aanzet: niemand wil "vink" uit de telefoonluidspreker in een vogelhut.
- Een podcast gaat even zachter (audiofocus "ducking") en daarna weer verder.
- Kort houden: soort, aantal, en "onzeker" als dat zo is. Bij meer dan twee waarnemingen in één uitspraak alleen het aantal ("drie waarnemingen").
- Eigen plugin `Spreken`; in de PWA terugvallen op `speechSynthesis` waar dat werkt.

Past al bij stap 1 (scherm aan), en wordt pas echt nuttig in stap 3.

## Stap 3: opnemen met het scherm uit (fase 3 van het Capacitor-plan)

De grote stap. De `WandelingService` neemt dan zelf op met de microfoon en geeft de opname aan de webcode, die hem zoals nu eerst lokaal bewaart (local-first blijft in de webcode).

Wat er native bij komt:

- **Servicetype `microphone`** naast `location`. Android 14+ staat dat alleen toe als de service start terwijl de app op het scherm staat; dat is bij "Begin met vogelen" zo. Wel een nieuwe verklaring in de Play Console (met video), net als voor `location`.
- **Opname in de service** (`AudioRecord`, zelfde formaat als nu), met dezelfde regels als de webknop: maximale duur, korte spookopnames.
- **De knop op de oortjes of een Bluetooth-afstandsbediening** via een mediasessie. Let op: Android stuurt de mediaknop naar de app die het laatst geluid afspeelde. Met een podcast aan krijgt die de knop, niet Fluistervink. Uitzoeken in een proef; de volumeknop (stap 1) werkt ook met het scherm uit zodra de service hem opvangt.
- **Welke microfoon:** nu bewust die van de telefoon (fase 0, tegen haperende audio). Voor fietsen met oortjes (Maarten) is de microfoon van de oortjes juist nodig, maar Bluetooth-microfoons klinken veel slechter (smalbandig). Een instelling "Microfoon: telefoon / oortjes", en de testset laten zien wat het kost aan herkenning.

Wat het oplevert:

- Telefoon in de zak, knop indrukken, inspreken, tril (of stem) terug. Fietsen met oortjes wordt mogelijk.
- **Trektelmodus met het scherm uit**, zonder Wake Lock: scheelt veel accu op een telpost.
- De basis voor het wake word.

Eerst een korte proef-PR (opnemen in de service, één opname doorgeven, meten), net als in fase 2. Werkt de overdracht naar de WebView op de achtergrond niet goed, dan overleggen voor de nette uitwerking.

**Stand (17 nov): proef gebouwd, draft-PR, niet mergen vóór de productierelease.** Ontwikkeloptie "Opnemen met het scherm uit" (`schermUit`). Hoe het werkt:

- De service krijgt het type microfoon pas als de webcode het aanzet (`SchermUitPlugin.aan`, vanuit het sessiescherm, dus met de app op het scherm). Lukt dat niet (geen toestemming, Android weigert), dan blijft hij gewoon locatie.
- **Volumeknop met het scherm uit:** een mediasessie met een eigen volumeregeling (`VolumeProvider`), alleen actief met het scherm uit of tijdens een opname. Android geeft de volumeknop dan aan die sessie in plaats van het volume te veranderen. Met de app op het scherm blijft het de bestaande KnopPlugin (stap 1).
- **Opname:** `AudioRecord` → AAC in .m4a (`audio/mp4`, 32 kbit/s mono, 16 kHz). Opus zoals de webknop kan Android pas vanaf versie 10 maken; de app moet vanaf 8. Dezelfde regels als de webknop: hooguit 3 minuten, korter dan 0,5 s wordt weggegooid. Trillen bij start en stop doet de service zelf (patronen van de webcode), zodat het niet op de WebView wacht.
- **Overdracht:** het bestand staat eerst op de telefoon (`files/scherm-uit/`, de naam bevat sessie, starttijd en duur), gaat als base64 in een gebeurtenis naar de webcode, die hem met `submitRecording` bewaart en dan pas het bestand laat weghalen. Mist de webcode hem (app gesloten), dan haalt `wachtend` hem bij de volgende keer (zonder positie).
- **Meten:** `screen_off_recording` in het log met `finishMs` (bestand afmaken), `bridgeMs` (Java → WebView), `transferMs` (volumeknop → aangekomen), `saveMs` (IndexedDB), `hidden` en `peak` (0 = Android gaf alleen stilte). Verder `screen_off_on`, `screen_off_knop_aan/uit`, `screen_off_started`, `screen_off_weggegooid`, `screen_off_niet_gestart`, `screen_off_mediaknop`.

Eerste meting (17 nov, eigenaar, twee opnames met het scherm uit, beide goed verwerkt): de webcode hoort binnen 10–20 ms dat een opname begint; van de volumeknop (stop) tot de opname in de webcode ±0,36 s, waarvan ±0,35 s het afmaken van het bestand en maar ±10 ms de overdracht naar de WebView; bewaren 30–50 ms. **De overdracht werkt dus goed**, ook met de app op de achtergrond. Het afmaken kan korter met kleinere stukken uit `AudioRecord` (nu een halve seconde).

Nog uit te zoeken in het veld (en daarna de nette uitwerking):

- Of de volumeknop met het scherm uit echt bij de mediasessie aankomt, ook met een podcast aan (Android geeft de volumeknop aan de sessie die "speelt"; een podcast speelt dan ook) en op een Samsung (die vangt de volumeknop soms zelf).
- **Knop op de oortjes:** de mediasessie logt alleen welke mediaknop binnenkomt (`screen_off_mediaknop`), en doet er niets mee. Android stuurt de mediaknop naar de app die het laatst echt geluid afspeelde; onze sessie speelt niets, dus waarschijnlijk komt hij niet aan zolang er een podcast of muziek-app is geweest. Uitzoeken in de volgende PR (eventueel een kort stil geluid afspelen om de knop te krijgen, maar dat neemt de knop van de podcast af).
- **Microfoonkeuze:** nu altijd `MIC` (die van de telefoon, zonder echo-onderdrukking). Voor de oortjes: `AudioRecord.setPreferredDevice` met een Bluetooth-SCO-apparaat, en de SCO-verbinding aanzetten (`AudioManager.setCommunicationDevice`, Android 12+); dat zet de oortjes in belmodus (smalbandig, podcast pauzeert). Volgende PR, met de testset erbij.

## Stap 4: de microfoon delen

Zodra de microfoon lang open staat (trektelmodus nu al, het wake word straks), botst dat met Merlin en met bellen. Met `AudioRecordingCallback` merkt de app dat een andere app de microfoon wil, laat hem los, en pakt hem daarna terug (twee korte trillen bij pauzeren en hervatten). Staat in de latere roadmap van `CLAUDE.md`; wordt pas nodig bij stap 5, of eerder als Maarten er bij het trektellen last van heeft.

**Stand (11 nov):** het deel dat nu al kan, zit achter een ontwikkeloptie: een trektelling pauzeert bij een andere app in plaats van te stoppen, en gaat verder als je terugkomt (binnen 15 minuten). De native `AudioRecordingCallback` voegt pas iets toe als de app ook op de achtergrond opneemt (stap 3): zolang Fluistervink alleen op het scherm opneemt, geeft Android de microfoon vanzelf aan de app op het scherm.

## Stap 5: het wake word "Fluistervink"

Pas na stap 3 en 4: de app moet dan continu luisteren, met het scherm uit, en de microfoon kunnen delen.

- **Herkenning op de telefoon zelf**, nooit continu audio naar een server. Pas na het wake word begint een gewone opname.
- Twee kandidaten:
  - **Porcupine** (Picovoice): eigen woord in een paar minuten te maken, kan Nederlands, zuinig. Licentie nagaan: gratis voor persoonlijk gebruik, maar een app in de Play Store is mogelijk een betaalde licentie.
  - **openWakeWord**: open source, model zelf trainen (met synthetische stemmen), draait via ONNX. Meer werk, geen licentiekosten.
- Grootste risico's: **valse meldingen** (wind, gesprekken, "fluister" in een zin) en **accu**. Eerst een proef van een paar wandelingen die alleen logt wanneer hij afgaat, zonder op te nemen; daarna beslissen.
- `#privacy` en `#uitleg` bijwerken: wat er luistert, wat er weggaat (niets tot het wake word).

Op de roadmap naar v1.0 stond het wake word bewust buiten v1.0 (de knop bevalt). Dat blijft zo: dit is na de lancering.

## Daarnaast, zonder native code

Uit de voorstellen van 8 nov, nog open; kunnen tussen de stappen door, want ze vragen geen nieuwe app-versie:

- **Geen verzonnen soort uit de STT-prompt** ("Roepje vink." bij een onverstaanbare opname). Meten met de testset.
- **Onwaarschijnlijke soort wordt onzeker** (zeldzaamheid van waarneming.nl; de dwaalgasten uit #182 zijn al altijd onzeker).
- ~~**"Wat zei ik?"** in het veld~~: gebouwd als ontwikkeloptie (#192), op 12 nov weer weggehaald: de lijst met uitspraken onderaan laat hetzelfde zien.
- **Samenvatting na een sessie** en een **herinnering aan de export**.
- **Trektelmodus fase 2 en 3** (beveiligingen, plafond in de proxy, uitleg), na de proef met Maarten; daarna eventueel export naar trektellen.nl.

## Volgorde en samenhang met de lancering

| Stap | Wat | Native? | Wanneer |
| --- | --- | --- | --- |
| 1 | Volumeknop en sluiterknopje als inspreekknop, snelkoppeling | ja, klein | nu, tijdens de gesloten test |
| 2 | Gesproken bevestiging | ja, klein | na stap 1 |
| 3 | Opnemen met het scherm uit, knop op de oortjes, microfoonkeuze | ja, groot | proef nu kan; nette uitwerking na de productierelease (nieuwe verklaring bij Google) |
| 4 | Microfoon delen met Merlin | ja | met of na stap 3 |
| 5 | Wake word | ja, groot | na de lancering, eerst een proef |
| – | iPhone-app | – | na de lancering, `docs/plan-ios.md` |

Elke stap is één à twee PR's en gaat eerst op een wandeling mee voordat de volgende begint. Bij native wijzigingen: een debug-APK in `apk/`, daarna een tag voor Play.

## Besloten (11 nov)

1. Volumeknop: **tikken** om te starten en te stoppen. Of dat prettig werkt, merken we in het veld.
2. Gesproken bevestiging: **alleen met oortjes**, nooit via de luidspreker.
3. Stap 3 (opnemen met het scherm uit) **na de productierelease**.
4. Wake word: **open source** (openWakeWord), geen licentie.

5. **Alleen voor de eigenaar tot het bevalt:** nieuwe functies uit deze roadmap komen achter een ontwikkeloptie die alleen met de code van de eigenaar zichtbaar is (zoals Developer, `isOwner` in `App.svelte`). Uitzondering: de volumeknop, die is voor iedereen (eerst standaard uit, sinds 16 nov standaard aan). De gesproken bevestiging is sinds 16 nov een proef voor iedereen, standaard uit. Native delen gaan gewoon mee in de Play-versie en doen bij anderen niets.
6. **Geen aparte ontwikkel-app.** Gevolg: stap 3 en 5 vragen een nieuwe toestemming (microfoon in de service) die Google bij elke release met een verklaring wil zien, ook als alleen de eigenaar de functie gebruikt. Die stappen wachten dus echt tot na de productierelease (punt 3).

Stap 1 is begonnen (PR #185).
