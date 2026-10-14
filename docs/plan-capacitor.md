# Plan: de native laag (Capacitor)

Goedgekeurd op 13 okt 2026: live laden, app-ID `nl.hegmus.fluistervink`, verspreiden via de interne test van Google Play. Telefoon van de eigenaar: Android 15. Volgt op de roadmap naar v1.0 in `NOTES.md` (spoor 1) en de conclusie van `docs/mijlpaal-mvp.md`.

## Doel

De app in een Android-schil verpakken, zodat hij doet wat een PWA niet kan. In volgorde van ergernis in het veld:

1. **Trillen, ook als de app op de achtergrond staat of het scherm uit is.** Nu mist de bevestiging als je de telefoon na het inspreken meteen wegstopt (verwerken duurt 4–5 s).
2. **Trillen zonder de instelling "Touch feedback"** van Android. Chrome trilt nu alleen als die aan staat.
3. **Later: opnemen zonder naar het scherm te kijken**, en de podcast via Bluetooth niet laten haperen.

Het wake word valt buiten dit plan (zie de roadmap).

## Wat niet verandert

- **De webcode blijft de app.** Svelte, Dexie, de wachtrij, het model, de review, de export: alles blijft zoals het is. Capacitor toont dezelfde webapp in een WebView en voegt een paar native functies toe.
- **De proxy, het datamodel en de prompt** blijven ongewijzigd.
- **De PWA blijft bestaan**, voor iPhone (Safari) en voor wie geen app wil installeren. Native functies zitten achter één bestand, `src/lib/native.ts`, met de huidige web-API's als terugval. De webcode blijft zo platformonafhankelijk.

## Keuzes

### 1. De webcode live laden van de site (aanbevolen) of in de app meeleveren

Capacitor kan de webcode meeleveren in de app, of de app laten openen op `https://fluistervink.stephanmullernl.workers.dev` (`server.url`).

**Voorstel: live laden.**
- Elke gemergde PR staat dan meteen ook in de Android-app, zonder een nieuwe app te bouwen of te verspreiden. Alleen wijzigingen aan de native code vragen een nieuwe versie. Dat past bij hoe je nu werkt: vaak kleine PR's, en testen in productie.
- De app heeft dezelfde origin als de site, dus `/api/...` werkt zonder CORS-aanpassingen in de proxy.
- De bestaande updatelogica (#65, geen nieuwe versie midden in een wandeling) blijft werken. Hetzelfde geldt voor de service worker, en daarmee voor opstarten zonder bereik. Dat moet wel nagegaan worden in de WebView.

Nadelen:
- De app en de PWA in Chrome hebben **elk hun eigen database**. Je zet je wandelingen één keer over met JSON-export en -import (scherm Developer).
- Bij een echte release, met de twee omgevingen uit de roadmap, kiest de app de stabiele omgeving.

Meeleveren is de nette weg voor een openbare app. Bij een besloten kring kost het bij elke PR een nieuwe app-versie, en dat weegt nu zwaarder.

### 2. App-ID

Een app-ID is definitief zodra de app in de Play Store staat. Voorstel: `nl.hegmus.fluistervink`, naar het eigen domein heg-mus.nl. Een streepje mag niet in een app-ID.

### 3. Verspreiden

- **Eerst:** zelf installeren via USB vanuit Android Studio.
- **Daarna, voor de testers:** Google Play Console, track "Interne test". Dat kost eenmalig $25 en is geschikt voor tot 100 testers via e-mailadres. Updates komen automatisch, er is geen beoordeling van weken, en de verplichte gesloten test met 12 testers geldt pas voor de echte Play Store.
- Een los APK-bestand delen kan ook. Dan moeten testers onbekende bronnen toestaan en zelf updates installeren.

## Fasen

Elke fase is één à twee PR's en wordt op een wandeling getest voordat de volgende begint.

### Fase 0: voorbereiding (eigenaar, eenmalig)

- Android Studio installeren. De juiste Java-versie zit erbij.
- Op de telefoon de ontwikkelaarsopties aanzetten, met USB-foutopsporing.
- Los van Capacitor, als kleine PR in de PWA: bij het opnemen de microfoon van de telefoon kiezen in plaats van die van een Bluetooth-headset (`deviceId` uit `enumerateDevices`). Misschien lost dat het haperen van de podcast al op, zonder native code. Werkt het niet, dan komt het terug in fase 3.

### Fase 1: de schil, en trillen met patronen

- Capacitor toevoegen (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`), met `capacitor.config.ts` (`server.url`, app-ID) en de map `android/` in git.
- **Eigen plugin `Trillen`** in Java (zoals de `MainActivity` van Capacitor; Kotlin vraagt een extra Gradle-plugin), in `android/`: trilpatronen via `VibrationEffect.createWaveform`. Daarbij het gebruik "communicatieverzoek" in plaats van "aanraking", zodat de instelling "Touch feedback" er niet meer toe doet. "Melding" werd in de stille stand tegengehouden (getest 14 okt). `vibrate()` in `src/lib/feedback.ts` gebruikt de plugin als die er is, anders `navigator.vibrate`.
- Toestemmingen in het manifest: microfoon, locatie. Capacitor vraagt ze, wanneer de webcode `getUserMedia` of de geolocatie gebruikt.
- Herkenbaar maken in het gebeurtenissenlog en de export: platform (`android-app` of `web`) en de versie van de app.
- **Klaar als:** de app staat op de telefoon, een wandeling werkt precies als in Chrome, en de trilpatronen komen door met "Touch feedback" uit.

### Fase 2: doorwerken op de achtergrond

- **Foreground service tijdens een wandeling**, gestart bij "Start wandeling" en gestopt bij "Stop wandeling", met een vaste melding "Wandeling loopt". Daardoor houdt Android de app in leven met het scherm uit, en blijven de wachtrij en de warme GPS werken. Servicetype `location`. Een opname begint nog steeds met de knop op het scherm.
- Trillen na het verwerken komt dan ook door als het scherm al uit is of de telefoon in je zak zit. Dat is het doel van deze fase.
- **Eerst een proef, vóór de nette uitwerking:** blijft de JavaScript in de WebView op de achtergrond draaien? Komen de verzoeken aan de proxy terug, en volgt dan de tril? Het gebeurtenissenlog meet dit al: achtergrond, tijden per stap en `vibrate_blocked`. Werkt de GPS van de WebView (`watchPosition`) op de achtergrond niet goed genoeg, dan gaat de positie via de Geolocation-plugin van Capacitor.
- Bij het stoppen van de wandeling verdwijnt de melding. Na 8 uur stopt hij vanzelf, net als de wandeling (`checkStaleSession`).
- `#uitleg` en `#privacy` bijwerken: het trillen, de melding, en dat Google Play weet dat je de app hebt.
- **Klaar als:** op een wandeling: knop indrukken, inspreken, scherm uit. Een paar seconden later voel je het juiste patroon, ook bij een onzekere waarneming of een fout.

### Fase 3: opnemen zonder te kijken (aparte beslissing, na fase 2)

Pas beginnen als fase 2 in het veld bevalt. De vraag is dan vooral **hoe je een opname start met het scherm uit**:

- de volumeknop (via een mediasessie; werkt ook met het scherm uit, maar dan reageert de knop tijdens een wandeling niet meer op het volume),
- de knop van een Bluetooth-oortje of een kleine Bluetooth-afstandsbediening,
- een knop in de melding, maar die vraagt vaak eerst om ontgrendelen,
- het wake word, later.

Dan neemt de service zelf op (native, met de microfoon van de telefoon, dus ook zonder de Bluetooth-belmodus) en geeft de opname aan de webcode, die hem net als nu eerst lokaal bewaart. Local-first blijft in de webcode.

### Fase 4: verspreiden naar testers

- Play Console-account en een interne test, met het ondertekenen door Google (Play App Signing).
- Een release bouwen in GitHub Actions (AAB) bij een tag, zodat het niet van één computer afhangt.
- Uitnodigingsmail: Android-testers krijgen de link naar de interne test plus hun toegangscode. iPhone-testers houden de PWA.

## Risico's en open vragen

- **JavaScript op de achtergrond in de WebView.** Android en Chromium kunnen een WebView op de achtergrond afremmen. De foreground service houdt het proces in leven, maar of de WebView meedraait, blijkt pas uit de proef in fase 2. Werkt het niet, dan moet een deel van de wachtrij native (het wachten op het antwoord en het trillen). Dat is meer werk, en dan overleggen.
- **Servicetype en toestemmingen** verschillen per Android-versie; de telefoon van de eigenaar heeft Android 15, waar de strengste regels gelden. Een foreground service met type `location` mag alleen starten als de app op het scherm staat en de locatietoestemming al gegeven is; bij "Start wandeling" is dat zo.
- **Edge-to-edge** (Android 15): de app loopt door tot onder de statusbalk en de navigatiebalk. De bovenbalk en de onderkant van het wandelscherm moeten de ruimte vrijlaten (`env(safe-area-inset-*)` in CSS). Nagaan in fase 1.
- **Opstarten zonder bereik** met `server.url` hangt af van de service worker in de WebView. Dat gaan we in fase 1 na.
- **Kosten:** geen nieuwe. Alleen de $25 voor Play Console, en pas in fase 4.

## Wat bij te werken bij de start

- `CLAUDE.md`: Capacitor staat nu nog onder "bewust níet in de MVP". Verplaatsen naar een nieuw kopje over de native laag, met de keuzes hierboven.
- `README.md`: Android bouwen en installeren.
- `NOTES.md`: verwijzen naar dit plan.
