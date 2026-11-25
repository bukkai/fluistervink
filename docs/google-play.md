# Google Play: builds, ondertekenen en uploaden

Een nieuwe app-versie bouwt GitHub Actions bij een tag (`.github/workflows/release.yml`): twee ondertekende AAB's (Android App Bundle, het formaat dat Play wil), als artifacts bij de run. De winkelvermelding en de verklaringen staan in `docs/play-store/README.md`, de lancering in `docs/lancering.md`.

**Beta en stabiel** (`docs/omgevingen.md`): één app in Play (`nl.hegmus.fluistervink`), twee builds. De **beta** (`fluistervink-<tag>-beta`, heet "Fluistervink Beta", laadt de webcode van workers.dev) gaat naar de **interne test**. De **stabiele** (`fluistervink-<tag>-stable`, heet "Fluistervink", laadt `fluistervink.nl`) gaat naar de **gesloten test** ("Stabiel"), straks naar productie. Wie in beide lijsten staat, krijgt de beta: die heeft bij dezelfde tag het hogere `versionCode`. Upload daarom bij elke tag **allebei**; anders kan een tester via een nieuwere stabiele build ongemerkt op `fluistervink.nl` belanden, zonder zijn sessies (die horen bij het adres).

## Een nieuwe versie

Alleen nodig bij wijzigingen in `android/` of `capacitor.config.ts`; webwijzigingen staan meteen in de app. De afvinklijst per release staat in `docs/draaiboek-uitbrengen.md`.

1. Mergen naar `main`, dan `git tag v0.8 && git push origin v0.8` (elke tag een hoger nummer). Of op GitHub bij Actions → "Release Android" → **Run workflow** (zonder tag; versienaam `0.7+12`).
2. Bij **Actions** wachten tot de run groen is (een paar minuten) en onderaan de artifacts `fluistervink-<tag>-beta` en `fluistervink-<tag>-stable` downloaden (elk een zip met `app-release.aab`). Uitpakken.
3. Play Console → **Testen → Interne tests → Nieuwe release maken**: de beta-AAB, releasenaam, kort wat er nieuw is, Opslaan, Uitrollen.
4. **Testen → Gesloten tests → Stabiel**: hetzelfde met de stabiele AAB (straks ook **Productie**).
5. Als **releasenaam** de tag (`v0.8`): Play stelt zelf een naam voor, maar de naam van een eerdere release kan blijven hangen.

**Toestemmingen alleen in de beta:** wat in `android/app/src/stable/AndroidManifest.xml` staat, haalt de stabiele build uit het manifest (nu niets). Zo kan een native proef in de interne test, terwijl de stabiele app de nieuwe toestemming niet heeft. **Maar:** de interne test laat de upload zonder vragen door, terwijl de verklaring foreground service voor de hele app geldt. Daarna weigert Play elke release die beoordeeld wordt (gesloten test, productie) met "You must let us know whether your app uses any Foreground Service permissions", tot de verklaring ook de nieuwe toestemming noemt (gemerkt bij v0.4). Een toestemming alleen in de beta scheelt dus geen verklaring; hij kan alleen uitgerold worden voordat iedereen hem heeft. Na het uploaden nagaan bij **App-bundels** of de stabiele de toestemmingen heeft die hij hoort te hebben (sinds v0.7 ook `FOREGROUND_SERVICE_MICROPHONE`).

### Versienummers

Het versienummer komt vanzelf uit git (`android/app/build.gradle`). Play kent er drie:

- **versionCode**: 2 × aantal commits, +1 voor de beta, dus altijd hoger dan het vorige. Hieraan ziet Play wat nieuwer is; bij **App-bundels** staat per upload welke het is. Play weigert een AAB met een `versionCode` die al eerder is geüpload; dat gebeurt als je de workflow twee keer op dezelfde commit draait.
- **versionName**: wat Android en Instellingen tonen, uit de laatste tag: `0.7 (a783304)` op de tag zelf, `0.7+12 (…)` bij een build twaalf commits later.
- **Releasenaam**: vrije tekst in de Play Console, alleen voor jezelf; gelijk aan de tag.

Later kan het uploaden ook automatisch vanuit de workflow (met een serviceaccount van Google Cloud); voor af en toe een release is met de hand eenvoudiger.

## Ondertekenen

Met **Play App Signing** heeft Google de echte sleutel waarmee de app op telefoons komt (de *app signing key*). Wij ondertekenen alleen met een **upload-key**: daarmee bewijs je bij het uploaden dat de AAB van jou komt. Raak je de upload-key kwijt, dan kan Google hem vervangen; de app zelf blijft dezelfde.

De upload-key staat in `upload.jks` (alias `upload`), buiten de repository en met het wachtwoord in de wachtwoordbeheerder. **Nooit in git.** GitHub Actions krijgt hem via vier secrets (Settings → Secrets and variables → Actions); `android/app/build.gradle` gebruikt hem alleen als die er zijn. Lokaal (zonder secrets) blijft `assembleDebug` gewoon werken, en `bundleRelease` maakt dan een niet-ondertekende AAB die Play weigert.

| Secret | Waarde |
| --- | --- |
| `UPLOAD_KEYSTORE_BASE64` | de keystore als tekst: `base64 -i upload.jks \| pbcopy` |
| `UPLOAD_KEYSTORE_PASSWORD` | het wachtwoord van de keystore |
| `UPLOAD_KEY_ALIAS` | `upload` |
| `UPLOAD_KEY_PASSWORD` | het wachtwoord van de sleutel (hetzelfde) |

Een nieuwe upload-key (na verlies, via Google) maak je met `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000` (`keytool` hoort bij Java, bv. de Temurin 21 uit de README of die in Android Studio) en zet je daarna opnieuw in de secrets.

## Testers

1. **Testen → Interne tests → Testers** (beta, alleen de eigenaar) en **Testen → Gesloten tests → Stabiel → Testers**: e-maillijsten met de Google-accounts van de testers.
2. Links voor deelname: interne test `https://play.google.com/apps/internaltest/4701242842814722001`, gesloten test `https://play.google.com/apps/testing/nl.hegmus.fluistervink`.
3. Per tester: eerst het Google-account op de lijst zetten, daarna de link voor deelname sturen. Een iPhone-gebruiker krijgt het adres van de site (Safari, "Zet op beginscherm").
4. De tester opent de link op de telefoon, wordt tester en installeert de app uit Play. Een code is niet nodig: de app meldt zich vanzelf aan (Play Integrity). Wie wil, vult bij **Instellingen** een naam in, die de eigenaar op Developer ziet.

Na productie gaan testers die er zelf voor kiezen via een Google Group: `docs/plan-testers.md`.

**Van beta naar stabiel** (17 nov): de beta-app toont iedereen behalve de eigenaar een kaart om over te stappen (`src/lib/MoveToStable.svelte`): back-up maken (als er nog sessies niet naar waarneming.nl zijn geëxporteerd), via de link van de interne test "Programma verlaten", via de link van de gesloten test tester worden, de beta verwijderen, Fluistervink uit Play installeren en eventueel de back-up terugzetten. Play zet niemand vanzelf over, want de beta heeft het hogere `versionCode`. Wie zich ooit via de link van de interne test heeft aangemeld, blijft daar tester en krijgt de beta, ook als hij niet meer op de lijst staat (gemerkt 18 nov met een tweede account); daarom eerst "Programma verlaten". De beta blijft bij wie hem nog heeft gewoon werken, alleen zonder nieuwe AAB's.
