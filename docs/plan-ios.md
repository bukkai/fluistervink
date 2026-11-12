# Plan: Fluistervink als iPhone-app

Voorstel van 11 nov 2026, nog niet goedgekeurd. Volgt op `docs/plan-capacitor.md` (de Android-app) en komt pas na de lancering in Google Play (`docs/lancering.md`). Tot dan houden iPhone-gebruikers de PWA (Safari, "Zet op beginscherm").

## Doel

Hetzelfde als op Android: de app doet wat de PWA in Safari niet kan.

1. **Trillen.** Safari kan helemaal niet trillen (`navigator.vibrate` bestaat er niet), dus op een iPhone mist nu elke bevestiging. Dit is de grootste winst.
2. **Doorwerken met het scherm uit**, zodat de wachtrij doorloopt en de bevestiging komt als de telefoon in je zak zit. Op iOS is dit veel lastiger dan op Android (zie Risico's).
3. Te vinden in de App Store, voor wie niet weet wat "Zet op beginscherm" is.

## Wat niet verandert

- Dezelfde webcode, dezelfde proxy, hetzelfde datamodel. Capacitor heeft ook een iOS-schil; de webcode weet alleen via `src/lib/native.ts` waar hij draait. `PLATFORM` wordt daar vanzelf `ios-app`, dus het log en de export zijn al te onderscheiden.
- **Live laden** (`server.url`), net als op Android: een gemergde PR staat meteen in beide apps.
- Het app-ID `nl.hegmus.fluistervink` (bij Apple: bundle ID), zodat de naam overal gelijk is.
- De PWA blijft, ook voor iPhone-gebruikers die geen app willen.

## Keuzes

### 1. Eerst een proef op je eigen iPhone, dan pas beslissen over de App Store

Het Developer Program kost $99 per jaar (Android: eenmalig $25). Een proef op de eigen telefoon via Xcode kan met een gratis Apple-account (de app werkt dan 7 dagen, daarna opnieuw installeren). **Voorstel:** fase 1 gratis, en pas betalen als trillen en de achtergrond in het veld goed genoeg werken.

### 2. Beta en stabiel

In Play zijn dat twee testtracks met elk een eigen AAB. Bij Apple: **de beta via TestFlight** (intern tot 100 testers zonder keuring; extern tot 10.000 via een link, de eerste build met een lichte keuring; een build verloopt na 90 dagen) en **de stabiele versie in de App Store**. Net als op Android twee builds, met elk een andere `server.url`.

### 3. Bewijs dat het de echte app is: App Attest of Turnstile

Play Integrity (`IntegriteitPlugin.java`, `verifyPlayIntegrity` in `worker/install.ts`) bestaat alleen op Android. Op iOS doet **App Attest** (DeviceCheck) hetzelfde, maar vraagt een eigen Swift-plugin en een controle in de proxy die ingewikkelder is (een certificaatketen van Apple controleren in plaats van Google te vragen). **Voorstel:** eerst niets doen. `src/lib/install.ts` valt al terug op Turnstile als er geen verklaring is, en dat werkt ook in de WebView. App Attest pas als misbruik daar aanleiding toe geeft.

## Fasen

Elke fase is één à twee PR's en wordt in het veld getest voordat de volgende begint.

### Fase 0: voorbereiding (eigenaar, eenmalig)

- Xcode installeren uit de Mac App Store, met de iOS-simulator.
- Op de iPhone de ontwikkelaarsmodus aanzetten (Instellingen → Privacy en beveiliging), na de eerste keer aansluiten.
- Met je Apple-account aanmelden in Xcode (gratis account is genoeg voor fase 1).

### Fase 1: de schil, en trillen

- `@capacitor/ios` toevoegen en `npx cap add ios`: de map `ios/` in git, naast `android/`. Capacitor 8 gebruikt Swift Package Manager, CocoaPods is niet nodig.
- **Toestemmingsteksten in `Info.plist`**: microfoon (`NSMicrophoneUsageDescription`) en locatie tijdens gebruik (`NSLocationWhenInUseUsageDescription`), in het Nederlands. Zonder die teksten stopt de app zodra hij erom vraagt.
- **Eigen plugin `Trillen` in Swift**, met dezelfde naam als de Java-plugin, zodat `vibrateNative` in `native.ts` niet verandert. iOS kent geen vrije trilpatronen zoals Android, maar Core Haptics kan een reeks tikken van gekozen lengte en sterkte afspelen. De drie patronen (opgeslagen, niet begrepen, onzeker) moeten in de hand nog steeds te onderscheiden zijn; dat is de proef van deze fase.
- **Plugin `Versie`** in Swift: het versienummer uit git, net als `android/app/build.gradle` (`0.<aantal commits> (<hash>)`).
- Nagaan in de WebView: opnemen (`getUserMedia`, werkt in WKWebView sinds iOS 14.3; komt de vraag om toestemming één keer of twee keer?), de GPS (`watchPosition`), de service worker (opstarten zonder bereik), en de veilige randen boven en onder (notch, thuisbalk; `env(safe-area-inset-*)`).
- **Klaar als:** een sessie werkt op de iPhone zoals in Safari, en de drie trilpatronen zijn zonder te kijken uit elkaar te houden.

### Fase 2: doorwerken met het scherm uit (proef)

Op Android houdt een foreground service met een melding de app in leven. iOS heeft dat niet. Wat wel bestaat:

- **Achtergrondmodus `location`** (`UIBackgroundModes` in `Info.plist`): zolang de app de locatie volgt, mag hij doorlopen; bovenin staat dan een blauw pilletje. Dat past bij wat de app al doet (warme GPS tijdens een sessie) en vraagt alleen toestemming "tijdens gebruik", niet "altijd".
- Of de **JavaScript in de WebView** dan ook doorloopt, is onzeker: WKWebView pauzeert scripts meestal zodra de app naar de achtergrond gaat, ook als het app-proces zelf nog draait. De locatie komt dan wel binnen in Swift, maar de wachtrij in de webcode staat stil.
- **Eerst een proef**, net als in fase 2 van het Android-plan: knop indrukken, inspreken, scherm uit. Komt het verzoek aan de proxy terug, en volgt de tril? Het gebeurtenissenlog meet dit al.
- Trillen op de achtergrond kan Core Haptics waarschijnlijk niet (de haptische motor stopt als de app niet op het scherm staat). Terugval: een lokale melding met geluid uit en trillen aan, maar dan alleen het standaardpatroon van iOS, zonder onderscheid tussen opgeslagen en onzeker.
- **Werkt het niet**, dan blijft op de iPhone de regel "scherm aan tot de tril" (een paar seconden), en dat zetten we in `#uitleg`. De wachtrij native maken is te veel werk voor wat het oplevert. Overleggen.

### Fase 3: de rest van `native.ts`

- **Bestand opslaan** (`saveFileNative`, nu `BestandPlugin.java`): op iOS het deelmenu, waarmee je het bestand naar Bestanden, Mail of AirDrop stuurt. Nagaan of het uploadveld van waarneming.nl op een iPhone een CSV accepteert; anders ook daar xlsx (`src/lib/xlsx.ts`).
- **Scherm aan in de trektelmodus**: de Wake Lock van de browser (`trektelRecorder.svelte.ts`) werkt in Safari sinds iOS 16.4, maar in een WKWebView is dat niet zeker. Anders een kleine plugin die `isIdleTimerDisabled` zet.
- Naar de achtergrond stopt de trektelling, net als op Android: dat blijft zo.

### Fase 4: TestFlight en de App Store

Eigenaar:

- Apple Developer Program als persoon ($99 per jaar). In de EU daarbij aangeven of je **handelaar** bent (DSA): een handelaar staat met adres en telefoonnummer in de App Store. Zonder verkoop of advertenties is "geen handelaar" waarschijnlijk juist; zelf nalezen.
- In App Store Connect de app aanmaken met bundle ID `nl.hegmus.fluistervink`.

Claude (in PR's):

- **Privacy manifest** (`ios/App/App/PrivacyInfo.xcprivacy`): verplicht. Welke gegevens de app verzamelt, en per "gevoelige" API (bv. `UserDefaults`, opstarttijd) de reden. Capacitor en de plugins leveren hun eigen manifest; dat van de app moet aansluiten op `#privacy`.
- **Antwoorden voor de App Privacy-labels** in App Store Connect, naast die voor Gegevensveiligheid in `docs/play-store/README.md`: grotendeels dezelfde (audio, precieze locatie, installatie-id, diagnose; verwerkers OpenAI, Anthropic, Cloudflare). Privacybeleid: `https://fluistervink.nl/privacy`. `#privacy` aanvullen met Apple (TestFlight, App Store), en App Attest als dat er komt.
- **Exportcompliance**: `ITSAppUsesNonExemptEncryption = false` in `Info.plist` (alleen HTTPS), anders vraagt App Store Connect het bij elke build.
- **Bouwen in GitHub Actions**: een job op een macOS-runner in `.github/workflows/release.yml`, bij dezelfde tag `v0.*`, die beide builds maakt en naar TestFlight uploadt met een API-sleutel van App Store Connect (geheim in GitHub). Het ondertekenen regelt Xcode met die sleutel ("automatic signing"). Een macOS-runner telt bij GitHub zwaarder mee in de gratis minuten; bij een openbare repository is dat geen probleem.
- **Winkelvermelding**: teksten (grotendeels uit `docs/play-store/README.md`), leeftijdsclassificatie (vragenlijst), categorie, schermafbeeldingen van een iPhone van 6,9" (1320×2868), en voor de keurder: geen account nodig, wel microfoon en locatie, en een voorbeeldzin om in te spreken.
- Pictogram: 1024×1024 zonder transparantie; iOS rondt zelf af. Uit dezelfde bron als het Android-pictogram (`docs/lancering.md`, Logo).

## Risico's en open vragen

- **De keuring (richtlijn 4.2, "Minimum functionality").** Apple wijst apps af die vooral een website in een omhulsel zijn, en een app die met `server.url` live een site laadt valt de keurder op. Wat helpt: echte native functies (trillen, eventueel doorwerken op de achtergrond en later het wake word) in de beschrijving en de toelichting voor de keurder. Een eerste afwijzing is goed mogelijk; dan aanvullen, niet in beroep gaan. Dit is de reden om fase 1 en 2 eerst te laten slagen.
- **Code die na de keuring verandert (richtlijn 2.5.2).** JavaScript die WebKit uitvoert mag bijgewerkt worden, zolang het doel van de app niet verandert. Live laden mag dus, maar een grote nieuwe functie hoort eigenlijk in een nieuwe versie met keuring. Voor de Android-app geldt dit niet zo streng.
- **Trillen met het scherm uit** is op iOS misschien niet mogelijk zoals op Android (fase 2). Dan is de iPhone-app vooral "de PWA mét trillen".
- **Achtergrondlocatie bij de keuring**: Apple vraagt waarom een app op de achtergrond de locatie gebruikt. Het antwoord ("de plek van elke ingesproken waarneming tijdens een sessie, geen route") moet kloppen met de code: geen GPS-track bewaren, zoals nu.
- **Twee databases**, net als op Android: wie van de PWA naar de app gaat, zet zijn sessies over met de back-up bij Instellingen.
- **Kosten:** $99 per jaar, verder niets nieuws.

## Wat bij te werken bij de start

- `CLAUDE.md`: onder Platform iOS naast Android, en dat `native.ts` ook Swift-plugins heeft.
- `README.md`: iOS bouwen en op de eigen iPhone zetten.
- `docs/plan-capacitor.md` en `docs/google-play.md`: "iPhone-testers houden de PWA" bijwerken zodra er een TestFlight-link is.
- `NOTES.md` en `docs/README.md`: verwijzen naar dit plan.

## Bronnen (nagezocht 11 nov 2026)

Grotendeels uit samenvattingen door derden, niet uit Apple's eigen pagina's; vóór fase 4 nalopen op developer.apple.com.

- Richtlijnen 4.2 en 2.5.2: [MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper), [Capgo](https://capgo.app/blog/how-to-pass-app-store-review-2026/)
- Kosten en TestFlight-limieten: [Adalo](https://studio.adalo.com/blog/apple-developer-program-guide), [MacRumors](https://www.macrumors.com/roundup/apple-developer-program/)
- Schermafbeeldingen: [Adalo](https://studio.adalo.com/blog/app-store-screenshot-sizes-2026)
- JavaScript in WKWebView op de achtergrond: [Apple Developer Forums](https://developer.apple.com/forums/thread/64150), [Capgo](https://capgo.app/blog/why-ios-stops-background-location-updates-capacitor/)
