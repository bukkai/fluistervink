# Winkelvermelding in Google Play

Wat er in de Play Console is ingevuld (9 nov 2026), zodat het later na te kijken en bij te werken is. Roadmap: `docs/lancering.md`.

## Feature graphic

`feature-graphic.jpg` (1024×500, JPEG zonder alfakanaal), gemaakt uit `feature-graphic.html` met het huidige logo. Opnieuw maken na een wijziging, of met het nieuwe logo van de artiest:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1024,500 --screenshot=/tmp/fg.png "file://$PWD/docs/play-store/feature-graphic.html"
sips -s format jpeg -s formatOptions 92 /tmp/fg.png --out docs/play-store/feature-graphic.jpg
```

## Schermafbeeldingen

`screenshots/1-inspreken.png` t/m `5-start.png` (1082×1922, staand), in deze volgorde uploaden bij Winkelvermelding → Telefoon: lopende sessie, samenvatting na een sessie, onzeker nalopen met de kaart, export naar waarneming.nl, startscherm. Van de stabiele versie (zonder "beta") met verzonnen voorbeeldgegevens: een ochtend in de Amsterdamse Waterleidingduinen en een in Zuid-Kennemerland (`scripts/play-screenshots/seed.ts`), geen echte plekken van gebruikers. Opnieuw maken (bv. met het nieuwe logo) met `npm run play-screenshots`: start de dev-server in de stand van stable en een headless Chrome (in `/Applications`), en vraagt internet voor de kaarttegels.

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

**Nagekeken op 11 nov 2026** (kwaliteitsronde, tegen `#privacy` en de code op `82c1b73`): het formulier in de Play Console hoeft niet aangepast. Wat er sinds 9 nov bij kwam, valt onder wat er al staat:

- Het scherm Statistieken (hoeveel installaties de app gebruiken, per dag en week) rekent met het verbruik dat de proxy al telde: dat is **App interactions → Analytics**, met het installatie-id onder **Device or other IDs → Analytics**.
- Trektelmodus, volumeknop, snelkoppeling, tegel, samenvatting en exportherinnering sturen geen nieuwe gegevens. De gesproken bevestiging (ontwikkeloptie) spreekt op de telefoon zelf.
- Losse feedback gaat nu meteen weg in plaats van bij de volgende ronde, nog steeds alleen na toestemming: **Other user-generated content**.

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

Video (de eigenaar neemt hem op, niet-openbaar op YouTube, link in het formulier), zo'n 30–60 seconden op de telefoon met schermopname:

1. App openen, "Begin met vogelen": de melding "Aan het vogelen" verschijnt (meldingenbalk even omlaag trekken).
2. Een waarneming inspreken ("zes overvliegende houtduiven"); hij verschijnt in de lijst met de plek.
3. Scherm uit, een paar seconden wachten, scherm aan: de sessie loopt nog en de melding staat er.
4. Op de melding tikken opent de app. "Stop": de melding verdwijnt.
5. De sessie openen: de waarneming op de kaart.

## Short description

```
Spreek je vogelwaarnemingen in en zet ze thuis op waarneming.nl.
```

## Full description

```
Fluistervink is een notitieboekje voor vogelaars dat luistert. Je drukt op de knop, zegt wat je ziet of hoort, en de app maakt er een waarneming van, met tijd en plek erbij. Je hoeft niet te typen en nauwelijks naar je scherm te kijken: je ogen blijven bij de vogels.

ZO WERKT HET
Begin met vogelen, op een wandeling, op de fiets, in een vogelhut of in je tuin. Zie of hoor je iets, druk dan op de knop en zeg het gewoon:
• "Zes overvliegende houtduiven"
• "Roepje vink"
• "Buizerd, vijfhonderd meter zuid van hier"
• "Fringilla coelebs" (wetenschappelijke namen werken ook)

Fluistervink herkent de soort, het aantal en wat de vogel doet (overvliegend, zingend, roepend, ter plaatse) en legt de tijd en je GPS-positie vast.

VERBETEREN MET JE STEM
Verkeerd verstaan of nog een paar gezien? Zeg het gewoon: "nee, keep in plaats van vink", "nog drie erbij" of "die laatste weg".

ZONDER NAAR HET SCHERM TE KIJKEN
Een korte tril betekent opgeslagen, twee trillen dat de app je niet begreep, en een ander patroon dat het opgeslagen is maar met twijfel. Tijdens een sessie werkt de app door met het scherm uit; de tril komt ook met je telefoon op zak.

THUIS NALOPEN
Na afloop loop je je sessie na. De waarnemingen waar de app aan twijfelde, staan bovenaan: Klopt, Weg of Aanpassen. Je kunt opnames terugluisteren, alles op een kaart zien en de plek van een waarneming met de hand verzetten. Klopt de rest, dan is één tik genoeg.

NAAR WAARNEMING.NL
Nagelopen sessies zet je klaar en exporteer je in één bestand, dat je bij waarneming.nl importeert. Soorten, gedrag en telmethode staan al in de vorm die waarneming.nl verwacht.

GEEN ACCOUNT, GEEN ADVERTENTIES
Fluistervink is gratis, zonder account en zonder advertenties. Alles wat je inspreekt staat eerst op je eigen telefoon. Bij Instellingen maak je een back-up.

OPEN OVER AI
Om je stem te verstaan gaat je opname naar OpenAI, en om er een waarneming van te maken gaat de tekst naar Anthropic. Die gebruiken het niet om hun modellen te trainen. De app kiest alleen soorten uit de soortenlijst van waarneming.nl en verzint geen vogels, maar kan je wel verkeerd verstaan, vooral in de wind. Daarom loop je thuis na. Je hebt internet nodig om in te spreken.

Fluistervink is een persoonlijk project en staat los van waarneming.nl en Observation.org.

Privacy: https://fluistervink.nl/privacy
Vragen of feedback: info@fluistervink.nl
```
