# Google Play: interne test (fase 4)

Android-testers krijgen de app via de **interne test** van Google Play, in plaats van losse APK's. Een release bouwt GitHub Actions bij een tag (`.github/workflows/release.yml`): een ondertekende AAB (Android App Bundle, het formaat dat Play wil), als artifact bij de run. Plan: `docs/plan-capacitor.md`, fase 4.

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
2. Op GitHub bij **Actions** wacht je tot de run groen is (een paar minuten), en download je onderaan het artifact `fluistervink-v0.1` (een zip met `app-release.aab`). Uitpakken.
3. In de Play Console: **Testen → Interne tests → Nieuwe release maken**, de `.aab` uploaden, een releasenaam (mag de tag zijn) en kort wat er nieuw is. Opslaan en **Uitrollen naar interne test**.
4. Play vraagt eenmalig nog wat gegevens voordat je kunt uitrollen (onder **Dashboard → App instellen**): privacybeleid (de link naar `#privacy` van de site), app-toegang, advertenties (nee), contentclassificatie, doelgroep, gegevensveiligheid. De interne test werkt al voordat alles hiervan af is; Play laat zien wat verplicht is.

### 6. Testers toevoegen

1. **Testen → Interne tests → Testers**: een e-maillijst maken met de Google-accounts (Gmail-adressen) van de Android-testers. Hooguit 100.
2. Daar staat ook de **link voor deelname**. Die gaat in de uitnodigingsmail, naast de toegangscode (uitnodigen vanaf het scherm Developer).
3. De tester opent de link op de telefoon, accepteert, en installeert de app vanuit Play.

Jijzelf: de debug-APK die je nu hebt, is met een andere sleutel ondertekend. Verwijder die eerst; daarna installeer je de app uit Play, net als de testers.

## Een nieuwe versie

Alleen nodig bij wijzigingen in `android/` of `capacitor.config.ts`; webwijzigingen staan meteen in de app.

1. Mergen naar `main`, dan `git tag v0.2 && git push origin v0.2` (elke tag een hoger nummer).
2. Artifact downloaden en in de Play Console een nieuwe interne release maken (stap 5.3).

Het versienummer komt vanzelf uit git (`versionCode` = aantal commits), dus het is altijd hoger dan het vorige. Play weigert een AAB met een `versionCode` die al eerder is geüpload; dat gebeurt als je de workflow twee keer op dezelfde commit draait.

Later kan het uploaden ook automatisch vanuit de workflow (met een serviceaccount van Google Cloud); voor af en toe een release is met de hand eenvoudiger.
