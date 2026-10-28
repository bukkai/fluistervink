# Google Play: interne test (fase 4)

Android-testers krijgen de app via de **interne test** van Google Play, in plaats van losse APK's. Een release bouwt GitHub Actions bij een tag (`.github/workflows/release.yml`): twee ondertekende AAB's (Android App Bundle, het formaat dat Play wil), als artifacts bij de run. Plan: `docs/plan-capacitor.md`, fase 4.

**Beta en stabiel** (`docs/omgevingen.md`): één app in Play, twee builds. De **beta** (`fluistervink-<tag>-beta`, heet "Fluistervink Beta", laadt de webcode van workers.dev) gaat naar de interne test. De **stabiele** (`fluistervink-<tag>-stable`, heet "Fluistervink", laadt `fluistervink.nl`) gaat naar een gesloten test, later productie. Wie in beide lijsten staat, krijgt de beta: die heeft bij dezelfde tag het hogere `versionCode`. Upload daarom bij elke tag **allebei**; anders kan een tester via een nieuwere stabiele build ongemerkt op `fluistervink.nl` belanden, zonder zijn wandelingen (die horen bij het adres).

## Hoe het ondertekenen werkt

Met **Play App Signing** heeft Google de echte sleutel waarmee de app op telefoons komt (de *app signing key*). Wij ondertekenen alleen met een **upload-key**: daarmee bewijs je bij het uploaden dat de AAB van jou komt. Raak je de upload-key kwijt, dan kan Google hem vervangen; de app zelf blijft dezelfde. Daarom is dit veiliger dan zelf de enige sleutel beheren.

De upload-key staat in een keystore-bestand (`.jks`). GitHub Actions krijgt hem via vier secrets; `android/app/build.gradle` gebruikt hem alleen als die er zijn. Lokaal (zonder secrets) blijft `assembleDebug` gewoon werken, en `bundleRelease` maakt dan een niet-ondertekende AAB die Play weigert.

## Eenmalig, door de eigenaar

### 1. Play Console-account

1. Ga naar [play.google.com/console](https://play.google.com/console) en maak een ontwikkelaarsaccount aan (eenmalig $25). Kies een **persoonlijk** account.
2. Google vraagt een identiteitscontrole (legitimatie) en het verifiëren van een telefoonnummer. Dat kan een paar dagen duren.
3. Voor een interne test hoeft de app niet door de beoordeling en niet openbaar in de Play Store. (De regel voor nieuwe persoonlijke accounts, eerst 14 dagen een gesloten test met 12 testers, geldt alleen voor publiceren in productie.)

### 2. App aanmaken

1. In de Play Console: **App maken**. Naam "Fluistervink", taal Nederlands, app (geen game), gratis.
2. Het app-ID (`nl.hegmus.fluistervink`) vraagt Play niet hier; dat ligt vast bij de eerste upload (stap 5) en kan daarna niet meer veranderen.
3. Play App Signing staat standaard aan bij een nieuwe app. Laat dat zo.

### 3. Upload-key maken

Op de Mac, in een map buiten de repository (bv. `~/Documents/fluistervink-sleutels/`):

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` hoort bij Java (bv. de Temurin 21 uit de README, of `"/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool"`). Het vraagt een wachtwoord voor de keystore en je naam; de rest mag leeg blijven. Gebruik voor de sleutel hetzelfde wachtwoord als voor de keystore.

Bewaar `upload.jks` en het wachtwoord goed (bv. in je wachtwoordbeheerder). **Nooit in git.**

### 4. Secrets in GitHub

Op GitHub: repository → **Settings → Secrets and variables → Actions → New repository secret**. Vier stuks:

| Naam | Waarde |
| --- | --- |
| `UPLOAD_KEYSTORE_BASE64` | de keystore als tekst: `base64 -i upload.jks \| pbcopy` en dan plakken |
| `UPLOAD_KEYSTORE_PASSWORD` | het wachtwoord van de keystore |
| `UPLOAD_KEY_ALIAS` | `upload` (de `-alias` van keytool) |
| `UPLOAD_KEY_PASSWORD` | het wachtwoord van de sleutel (zelfde als hierboven) |

### 5. Eerste release bouwen en uploaden

1. Een tag zetten op `main` en pushen:

   ```bash
   git tag v0.1 && git push origin v0.1
   ```

   (Of op GitHub bij Actions → "Release Android" → **Run workflow**.)
2. Op GitHub bij **Actions** wacht je tot de run groen is (een paar minuten), en download je onderaan de artifacts `fluistervink-v0.1-beta` en `fluistervink-v0.1-stable` (elk een zip met `app-release.aab`). Uitpakken.
3. In de Play Console: **Testen → Interne tests → Nieuwe release maken**, de `.aab` van **beta** uploaden, een releasenaam (mag de tag zijn) en kort wat er nieuw is. Opslaan en **Uitrollen naar interne test**.
4. Zodra er mensen op de stabiele versie zitten: **Testen → Gesloten tests** (track aanmaken, bv. "Stabiel"), daar de `.aab` van **stable** uploaden en uitrollen.
5. Play vraagt eenmalig nog wat gegevens voordat je kunt uitrollen (onder **Dashboard → App instellen**): privacybeleid (de link naar `#privacy` van de site), app-toegang, advertenties (nee), contentclassificatie, doelgroep, gegevensveiligheid. De interne test werkt al voordat alles hiervan af is; Play laat zien wat verplicht is.

### 6. Testers toevoegen

1. **Testen → Interne tests → Testers**: een e-maillijst maken met de Google-accounts (Gmail-adressen) van de Android-testers (beta). Hooguit 100. Gebruikers van de stabiele versie gaan in de lijst van de gesloten test, met een eigen link.
2. Daar staat ook de **link voor deelname**. Zet die eenmalig in `PLAY_TEST_LINKS` in `src/lib/invite.ts` (`beta` voor de interne test, `stable` voor de gesloten test). Zolang die leeg is, stuurt de uitnodigingsmail Android-testers naar Chrome, zoals vroeger.
3. Per tester: eerst het Google-account op de lijst van stap 1 zetten, daarna uitnodigen vanaf het scherm Developer (op de beta voor de interne test, op `fluistervink.nl` voor de gesloten test). De mail bevat voor Android de link voor deelname en de toegangscode los; voor een iPhone de persoonlijke link.
4. De tester opent de link voor deelname op de telefoon, wordt tester, installeert de app uit Play en vult de code in bij **Instellingen**. De link met `#code=` werkt op Android niet voor de app: die opent in Chrome, en de app heeft eigen opslag, los van Chrome (zie hieronder, App Links).

Jijzelf: de debug-APK die je nu hebt, is met een andere sleutel ondertekend. Verwijder die eerst; daarna installeer je de app uit Play, net als de testers. **Let op:** verwijderen wist de wandelingen in de app. Maak eerst een JSON-export (met opnames) en importeer die daarna in de app uit Play.

## Later: App Links (voorstel, nog niet gebouwd)

Met App Links opent de link `https://…/#code=…` op Android de app in plaats van Chrome, mits de app geïnstalleerd is. Dan hoeft de tester de code niet over te tikken: Play-link, installeren, en daarna op de persoonlijke link tikken. Zonder app blijft de link gewoon in Chrome werken.

Wat ervoor nodig is:

1. **`public/.well-known/assetlinks.json`**: verklaart dat de app `nl.hegmus.fluistervink` bij de site hoort, met de SHA-256 van de **app signing key** van Play (Play Console → Testen en releasen → App-integriteit → App-ondertekening), en eventueel die van de debug-sleutel. Beide omgevingen serveren dezelfde bestanden en het is één app, dus één bestand. Controleren dat de Worker een map met een punt ervoor serveert (`curl https://fluistervink.nl/.well-known/assetlinks.json`).
2. **Intent-filter in `AndroidManifest.xml`** met `android:autoVerify="true"`, scheme `https` en de host van de omgeving (via een `manifestPlaceholder` per build in `android/app/build.gradle`, zodat de beta-app alleen links van workers.dev opent en de stabiele alleen die van `fluistervink.nl`). Android controleert bij het installeren het bestand van stap 1; klopt het niet, dan gaat de link stil naar Chrome. Nalopen met `adb shell pm get-app-links nl.hegmus.fluistervink`.
3. **`@capacitor/app`** (officiële plug-in) en in `src/lib/native.ts` een luisteraar op `appUrlOpen`, die de code uit het `#` haalt en hetzelfde doet als bij het openen van de link in de browser (opslaan, welkom tonen). Ook bij een koude start, als de app door de link opstart.

Kosten: ongeveer een middag werk, plus een nieuwe release (tag, beide AAB's uploaden), want stap 2 en 3 zijn native. Testers moeten de app bijwerken; tot dan werkt de code invullen bij Instellingen nog steeds. De mail kan daarna stap 3 vervangen door "tik op deze link", met de code los als terugval.

## Een nieuwe versie

Alleen nodig bij wijzigingen in `android/` of `capacitor.config.ts`; webwijzigingen staan meteen in de app.

1. Mergen naar `main`, dan `git tag v0.2 && git push origin v0.2` (elke tag een hoger nummer).
2. Beide artifacts downloaden en in de Play Console een nieuwe release maken: beta naar de interne test, stable naar de gesloten test (stap 5.3 en 5.4).

Het versienummer komt vanzelf uit git (`versionCode` = 2 × aantal commits, +1 voor de beta), dus het is altijd hoger dan het vorige. Play weigert een AAB met een `versionCode` die al eerder is geüpload; dat gebeurt als je de workflow twee keer op dezelfde commit draait.

Later kan het uploaden ook automatisch vanuit de workflow (met een serviceaccount van Google Cloud); voor af en toe een release is met de hand eenvoudiger.
