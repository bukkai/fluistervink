# Winkelvermelding in Google Play

Wat er in de Play Console staat, zodat het na te kijken en bij te werken is. De teksten hieronder moeten één op één gelijk zijn aan de Console; pas ze hier aan als je ze daar aanpast. Roadmap: `docs/lancering.md`.

## Feature graphic

`feature-graphic.jpg` (1024×500, JPEG zonder alfakanaal), gemaakt uit `feature-graphic.html` met het huidige logo. Opnieuw maken na een wijziging, of met het nieuwe logo van de artiest:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1024,500 --screenshot=/tmp/fg.png "file://$PWD/docs/play-store/feature-graphic.html"
sips -s format jpeg -s formatOptions 92 /tmp/fg.png --out docs/play-store/feature-graphic.jpg
```

## Schermafbeeldingen

`screenshots/1-inspreken.png` t/m `6-trektellen.png` (1082×1922, staand; gemaakt 25 nov, in de Console nog die van 9 nov, met het verdwenen "Nieuw dit jaar"), in deze volgorde uploaden bij Winkelvermelding → Telefoon: lopende sessie, samenvatting na een sessie, onzeker nalopen met de kaart, export naar waarneming.nl, startscherm, lopende trektelling. Van de stabiele versie (zonder "beta") met verzonnen voorbeeldgegevens: een ochtend in de Amsterdamse Waterleidingduinen een in Zuid-Kennemerland en een trektelling op een duintop (`scripts/play-screenshots/seed.ts`; de stand van de telling zet het script zelf, zonder microfoon, dus er gaat niets naar spraakherkenning of model), geen echte plekken van gebruikers. Opnieuw maken (bv. met het nieuwe logo) met `npm run play-screenshots`: start de dev-server in de stand van stable en een headless Chrome (in `/Applications`), en vraagt internet voor de kaarttegels.

## Categorie

Education (daar staan Merlin, eBird, BirdNET en iNaturalist), met tags over vogels en natuur.

## Gegevensveiligheid

Overal alleen **Collected**, nergens **Shared**: OpenAI, Anthropic, Cloudflare, Google (Play Integrity), waarneming.nl (gebiedsnaam) en OpenStreetMap (kaarttegels) verwerken namens ons (service providers); export en back-up doet de gebruiker zelf. "Processed ephemerally" overal **No**: elk type wordt ook ergens bewaard (delen, verbruik).

| Gegevenstype | Required / optional | Purposes |
| --- | --- | --- |
| Precise location | Required | App functionality, Analytics |
| Voice or sound recordings | Required | App functionality, Analytics |
| Other user-generated content | Required | App functionality, Analytics |
| App interactions | Required | Analytics |
| Diagnostics | Required | Analytics |
| Device or other IDs | Required | App functionality, Analytics, Fraud prevention, security, and compliance |
| Name | Optional | App functionality |

Verder: versleuteld onderweg ja; geen accounts; verwijderen aanvragen ja, via `https://fluistervink.nl/privacy`. Bijwerken als gegevens een nieuwe kant op gaan (zelfde moment als `#privacy`).

**Laatst nagekeken: 25 nov 2026**, geen wijziging nodig. Zo vallen de latere onderdelen onder wat er al staat:

- Verbruik per installatie, het scherm Statistieken, de soort uitspraak, taal, versie en soort toestel, en de anonieme cijfers per sessie (`src/lib/summaries.ts`): **App interactions → Analytics**, met het installatie-id onder **Device or other IDs → Analytics**.
- Losse feedback (meteen, na toestemming): **Other user-generated content**.
- Trektelmodus, opnemen met het scherm uit, volumeknop, snelkoppeling, tegel, samenvatting en exportherinnering sturen geen nieuwe gegevens. De gesproken bevestiging spreekt op de telefoon zelf.

Keuzes om te onthouden:

- **Waarneming.nl en OpenStreetMap** tellen we ook als verwerkers, niet als **Shared**. Waarneming.nl krijgt alleen coördinaten van onze server, zonder iets van de gebruiker erbij (gebiedsnaam opzoeken); OpenStreetMap levert de kaarttegels en ziet daarbij het IP-adres en welk gebied iemand bekijkt. Beide doen alleen iets voor de app zelf. Vindt Google dat ooit anders, dan wordt het **Precise location → Shared → App functionality**.
- **Back-up van Android** (`allowBackup`, staat aan): de telefoon neemt de app-opslag mee in de back-up naar het eigen Google-account van de gebruiker. Dat is niet iets wat de app of de ontwikkelaar verzamelt, dus het staat niet in het formulier en niet in `#privacy` (besloten 11 nov, zie `docs/kwaliteitsronde.md`).
- **Diagnostics** en de **Analytics** bij locatie, opnames en inhoud gelden vooral voor wie deelt met de ontwikkelaar (vrijwillig). Ze staan toch op Required, omdat het logboek van de server en het verbruik er altijd zijn; te veel aangeven is veiliger dan te weinig.

## Verklaring foreground service

Play Console → Beleid en programma's → App-content → **Foreground service-rechten**. De app heeft één foreground service, `WandelingService` (type `location`, recht `FOREGROUND_SERVICE_LOCATION`): de melding "Aan het vogelen" tijdens een sessie. Hij doet zelf niets, maar houdt Android ervan af de app te bevriezen met het scherm uit, zodat de GPS warm blijft, uitspraken verwerkt worden en de tril komt. Geen `ACCESS_BACKGROUND_LOCATION`: de service start altijd vanuit de app op het scherm, dus de toestemming "tijdens gebruik" volstaat, en een aparte verklaring voor locatie op de achtergrond is niet nodig.

Taaktype: **Other** (geen navigatie of fitness; "Location sharing" klopt ook niet, er wordt niets live gedeeld). De tekst in het Engels, voor de beoordelaars:

```
Fluistervink is a voice notebook for birdwatchers. During a birding session (a walk, a bike ride, an hour in a bird hide) the user presses a button and speaks an observation, e.g. "six wood pigeons flying over". The app records the time and the precise GPS position of that moment, turns the speech into a structured bird observation, and confirms with a vibration, so the user can keep their eyes on the birds. At home the user reviews the session on a map and exports it to waarneming.nl / observation.org, the Dutch and international biodiversity database.

The location foreground service runs only while a session is active. The user starts it explicitly with "Begin met vogelen" (start birding) and stops it with the "Stop" button; it also stops automatically 8 hours after the last observation. A persistent notification "Aan het vogelen" (birding) is shown the whole time, and tapping it opens the app. The service starts while the app is in the foreground, and the app only holds the "while in use" location permission (no background location permission).

Why it is needed: birders put the phone in their pocket with the screen off between observations. Without the foreground service Android freezes the app, so (1) the GPS goes cold and the next observation gets no position or a position from minutes ago, often hundreds of metres off, while the location of each observation is required by the observation database; (2) an observation spoken just before the screen turned off is not processed, and the confirming vibration never arrives, so the user does not know whether it was saved. With the service, GPS stays warm and each observation gets an accurate position the moment the user starts speaking.

User impact if deferred or interrupted: observations get no or wrong locations and cannot be exported correctly, and the user must look at the screen to check every observation, which defeats the purpose of the app. No location history or GPS track is stored: only the position at the moment of each spoken observation.
```

Video: niet-openbaar op YouTube, link in het formulier; draaiboek in `docs/archief/play-videos.md`.

### Microfoon (opnemen met het scherm uit)

Hetzelfde `WandelingService` heeft ook het type `microphone` (recht `FOREGROUND_SERVICE_MICROPHONE`), sinds v0.7 in beide builds, voor de keuze "Opnemen met het scherm uit" bij Instellingen. De verklaring geldt voor de hele app: een nieuwe toestemming eerst hier en in het formulier, anders weigert Play elke release die beoordeeld wordt (`docs/google-play.md`).

**Nog te doen vóór productie:** de tekst hieronder (sinds #390 ook de trektelling met het scherm uit, tot 4 uur doorlopend) in de Play Console zetten.

Taaktype: **Background audio input** (het formulier biedt alleen dat en Other). De tekst in het Engels:

```
In addition to location (see above), the same foreground service (WandelingService) uses the microphone type, for one setting, "Record with the screen off", which the user switches on in the app's settings. It covers two uses: recording a single spoken observation with a key press, and a migration count.

How it works: during an active birding session the user turns the screen off and puts the phone in a pocket. To record an observation, the user presses a volume key: the phone gives a short vibration and the service starts recording, and the notification changes to "Opname loopt · volumeknop stopt" (recording · volume key stops). The user speaks the observation ("two oystercatchers flying south") and presses the volume key again to stop; another short vibration confirms. The recording is saved on the device first and then transcribed and turned into an observation, exactly like a recording made with the on-screen button, followed by the usual confirming vibration.

For a single observation, the microphone is only open between those two key presses (at most 3 minutes per recording).

Migration count: a birder counting migrating birds from one spot keeps the phone nearby and reports what passes, often for hours. The user starts the count explicitly on the session screen; from then on the service records continuously and cuts the audio into chunks of about a minute, each of which is transcribed like a single recording. The notification then reads "Trektelling loopt · het scherm mag uit" (migration count running · the screen may be off). The count stops when the user stops it, after at most 4 hours, or when the daily limit of spoken audio is reached; when another app (for example a phone call) takes the microphone, the count pauses and the notification says so.

Apart from these two uses, started by the user, the app does not listen continuously and does not record in the background on its own. The microphone type is only added to the foreground service when the user has enabled the feature, and only while the app is in the foreground (when the session screen is open), as Android 14 requires. Outside a session the volume keys keep their normal function.

Why it is needed: birdwatchers hold binoculars in one hand and often wear gloves. Waking the screen, unlocking the phone and finding the record button takes several seconds, and a bird that calls or flies over is gone by then. With the screen off and a physical key, the user can record without looking at the phone. Without the microphone foreground service type, Android does not allow the app to record while the screen is off.

User impact if deferred or interrupted: the observation the user is speaking is lost, or the user has to take out the phone, unlock it and look at the screen, which is exactly what the app is meant to avoid.
```

Video: gefilmd met een tweede telefoon (een schermopname toont met het scherm uit alleen zwart); draaiboek in `docs/archief/play-videos.md`.

## Teksten

Play Console → Groei → Winkelaanwezigheid → **Hoofdwinkelvermelding**. Laatst gelijk gezet: 9 nov. **Nog te doen:** de lange beschrijving hieronder (bijgewerkt 25 nov: volumeknop met het scherm uit, trektellen, geen bereik, eBird, afschermen) in de Console zetten; de naam pas bij de productierelease.

### App name

Bij de productierelease (besloten 22 nov, `docs/plan-marketing.md`); tot dan "Fluistervink".

```
Fluistervink: vogels inspreken
```

### Short description

```
Spreek je vogelwaarnemingen in en zet ze thuis op waarneming.nl.
```

### Full description

```
Fluistervink is een notitieboekje voor vogelaars dat luistert. Je drukt op de knop, zegt wat je ziet of hoort, en de app maakt er een waarneming van, met tijd en plek erbij. Je hoeft niet te typen en nauwelijks naar je scherm te kijken: je ogen blijven bij de vogels.

ZO WERKT HET
Begin met vogelen, op een wandeling, op de fiets, in een vogelhut of in je tuin. Zie of hoor je iets, druk dan op de knop en zeg het gewoon:
• "Zes overvliegende houtduiven"
• "Roepje vink"
• "Buizerd, vijfhonderd meter zuid van hier"
• "Fringilla coelebs" (wetenschappelijke namen werken ook)

Fluistervink herkent de soort, het aantal en wat de vogel doet (overvliegend, zingend, roepend, ter plaatse) en legt de tijd en je GPS-positie vast. Zie je onderweg een ree, een pad, een vlinder of een libel, dan spreek je die ook in.

VERBETEREN MET JE STEM
Verkeerd verstaan of nog een paar gezien? Zeg het gewoon: "nee, keep in plaats van vink", "nog drie erbij" of "die laatste weg".

ZONDER NAAR HET SCHERM TE KIJKEN
Een korte tril betekent opgeslagen, twee trillen dat de app je niet begreep, en een ander patroon dat het opgeslagen is maar met twijfel. Tijdens een sessie werkt de app door met het scherm uit; de tril komt ook met je telefoon op zak. De volumeknop is de inspreekknop. Zet je bij Instellingen "Opnemen met het scherm uit" aan, dan start en stop je een opname met de volumeknop terwijl de telefoon in je zak zit.

TREKTELLEN
Tel je op één plek, met de telefoon naast je? Start dan een trektelling: de app luistert door en verwerkt alles wat je zegt, zonder dat je steeds op de knop hoeft te drukken.

GEEN BEREIK? GEWOON DOOR
De app bewaart wat je zegt op je telefoon en verwerkt het zodra er weer verbinding is.

THUIS NALOPEN
Na afloop loop je je sessie na. De waarnemingen waar de app aan twijfelde, staan bovenaan: Klopt, Weg of Aanpassen. Je kunt opnames terugluisteren, alles op een kaart zien en de plek van een waarneming met de hand verzetten. Klopt de rest, dan is één tik genoeg.

NAAR WAARNEMING.NL EN EBIRD
Nagelopen sessies zet je klaar en exporteer je in één bestand, dat je bij waarneming.nl importeert. Soorten, gedrag en telmethode staan al in de vorm die waarneming.nl verwacht, net als afschermen en embargo ("die ooievaar afschermen"). Gebruik je eBird, dan exporteer je je sessie ook als checklist, met duur en afstand.

GEEN ACCOUNT, GEEN ADVERTENTIES
Fluistervink is gratis, zonder account en zonder advertenties. Alles wat je inspreekt staat eerst op je eigen telefoon. Bij Instellingen maak je een back-up.

OPEN OVER AI
Om je stem te verstaan gaat je opname naar OpenAI, en om er een waarneming van te maken gaat de tekst naar Anthropic. Die gebruiken het niet om hun modellen te trainen. De app kiest alleen soorten uit de soortenlijst van waarneming.nl en verzint geen vogels, maar kan je wel verkeerd verstaan, vooral in de wind. Daarom loop je thuis na.

Fluistervink is een persoonlijk project en staat los van waarneming.nl en Observation.org.

Privacy: https://fluistervink.nl/privacy
Vragen of feedback: info@fluistervink.nl
```
