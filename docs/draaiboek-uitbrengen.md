# Draaiboek: een release uitbrengen

Voor elke release naar stable, met of zonder nieuwe app-versie. Kopieer de stappen niet, maar loop ze hier af; wat per keer verschilt (versie, teksten), noteer je in `NOTES.md`. De achtergrond staat in `docs/omgevingen.md` (beta en stable) en `docs/google-play.md` (ondertekenen, versienummers).

## 1. Klaar om uit te brengen?

- [ ] `main` is groen (`gh run list --branch main --limit 3`).
- [ ] Wat meegaat, staat in `docs/vrijgave.md` onder "Mee met de lancering"; wat nog niet mag, staat achter een schakelaar.
- [ ] Proeven op de telefoon voor wat meegaat zijn gedaan (`docs/draaiboek-*.md`, `NOTES.md`).

## 2. Changelog

In `src/lib/changelog.ts`, op een branch met een PR (CI draait mee), vóór `npm run release`:

- [ ] **Inkorten:** de dagen van vóór de vorige release worden `items` zonder onderwerpen: per dag één tot vier korte regels met de hoofdzaken; kleine fixes vallen weg. De dagen sinds de vorige release houden hun onderwerpen en volledige regels. De datum van de vorige release staat in `NOTES.md` ("Stable staat op …") of `git log -1 --format=%cs origin/stable`.
- [ ] **Nalezen:** de regels van na de vorige release kloppen met wat er nu werkelijk meegaat, in gewone taal, zonder ontwikkelopties. Komt er een nieuwe app-versie, dan noemt een regel die daarvan afhangt de versie ("vanaf versie 0.7 van de app").
- [ ] Mergen.

## 3. Nieuwe app-versie nodig?

Alleen bij wijzigingen in `android/` of `capacitor.config.ts`:

```bash
git fetch --tags && git diff --stat $(git describe --tags --abbrev=0 origin/main) origin/main -- android capacitor.config.ts
```

Staat er alleen `build.gradle` met de versienaam, of niets: ga naar stap 5.

## 4. App-versie (tag en Play)

- [ ] **Tag** op de laatste merge op `main`, nadat de check daar groen is: `git tag v0.X <commit> && git push origin v0.X`. De workflow **Release Android** bouwt twee AAB's.
- [ ] **Downloaden:** `gh run download <run-id> -D apk/v0.X`, en de twee `app-release.aab` hernoemen naar `fluistervink-v0.X-beta.aab` en `fluistervink-v0.X-stable.aab` (`apk/` staat niet in git).
- [ ] **Release notes** schrijven, per taal hooguit 500 tekens, met de taalcode eromheen. Alleen wat testers merken: eerst wat de app-versie brengt, dan in één zin de rest die tegelijk meegaat. Voor de stabiele zo:

  ```
  <nl-NL>
  Nieuw bij Instellingen: … Verder: …
  </nl-NL>
  <en-US>
  New in Settings: … Also: …
  </en-US>
  ```

  Voor de beta (alleen de eigenaar) mag het korter en technischer, met ontwikkelopties. Bewaar beide teksten in `NOTES.md` bij de release.
- [ ] **Interne test** (Play Console → Testen → Interne tests → Nieuwe release maken): de beta-AAB, **releasenaam = de tag** (`v0.X`; Play stelt soms nog de naam van een vorige release voor), release notes, Opslaan, Uitrollen.
- [ ] **Gesloten test** (Testen → Gesloten tests → de track → Nieuwe release maken): de stabiele AAB, dezelfde releasenaam, de release notes voor testers. Google beoordeelt deze release (uren tot dagen); het dashboard toont de stand.
- [ ] **App-bundels** (Testen en vrijgeven → App-bundels): de stabiele heeft de toestemmingen die hij hoort te hebben. Een nieuwe toestemming met een verklaring (foreground service): eerst de verklaring bijwerken (`docs/play-store/README.md`), anders weigert Play de beoordeling.
- [ ] **Productie** (zodra die er is): dezelfde stabiele AAB en teksten; bij het maken van de release de landen kiezen (Nederland en België).

## 5. Webcode naar stable

- [ ] `npm run release` (of `npm run release -- --ja`): laat zien wat er meegaat en zet `stable` gelijk aan `origin/main`. Workers Builds deployt `fluistervink.nl` binnen een paar minuten.
- [ ] Nalopen op `fluistervink.nl`: de app opent (`/app/`), `#nieuw` toont de nieuwe regels, `/privacy` laadt.

De volgorde met stap 4 maakt niet uit: een keuze die een nieuwe app-versie vraagt, toont de webcode pas als de app die heeft.

## 6. Daarna

- [ ] `NOTES.md`: "Stable staat op <commit> (release <datum>)", de app-versie in de interne en gesloten test, en de release notes.
- [ ] Testers mailen als er iets te merken is (`docs/lancering.md`, punt 4): nieuwste versie in Play binnenhalen, wat er nieuw is, feedback.
- [ ] Kwaliteitsronde op de beta (`docs/kwaliteitsronde.md`), met een regel in het logboek daar.
