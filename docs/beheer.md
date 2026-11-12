# Beheer: sleutels en de Android-app bouwen

Praktische weetjes voor de eigenaar, verplaatst uit `NOTES.md` op 12 nov 2026. Hoe je de Android-app voor het eerst opzet, staat in de README; releases in `docs/google-play.md`; de twee omgevingen in `docs/omgevingen.md`.

## API-sleutels

- Anthropic: `fluistervink` (6 nov 2026, opvolger van `spreeuw-api-key`), in de Fluistervink-workspace. **Verloopt 9 dec 2027.** Vervangen: in de Console (Settings → API keys) een nieuwe aanmaken in die workspace (anders ontbreekt de rekening op Developer), dan `npx wrangler secret put ANTHROPIC_API_KEY` en `… --env stable`, en lokaal `.dev.vars`. Proefopname op beta en stable, daarna de oude intrekken.
- `ANTHROPIC_ADMIN_KEY` (rekening op Developer) is een aparte sleutel, met een eigen verloopdatum.

## Android-app bouwen en installeren

- Bouwen vraagt Java 21 (Temurin uit `~/Library/Java/JavaVirtualMachines/`; Homebrew bouwt het op de Intel-Mac uit de broncode) en `JAVA_HOME` naar de Java van Android Studio, zie README.
- Installeren gaat draadloos (adb, draadloze foutopsporing): de USB-poort ziet de Fairphone niet. De verbinding valt weg als de telefoon op slot gaat of van wifi wisselt; dan opnieuw aanzetten. De poort vindt `adb mdns services`; koppelen (`adb pair`) blijft bewaard.
- Trillen als "communicatieverzoek": als "melding" hield Android het op stil tegen (`ignored_for_ringer_mode`). Nagaan met `adb shell dumpsys vibrator_manager`.
- De app heeft een eigen database (los van de PWA in Chrome): eenmalig overzetten met de JSON-export en -import.
- Icoon en opstartscherm (9 nov, PR #176): `npm run app-icons` maakt ze uit `public/icon.svg`; daarvoor stond het standaardicoon van Capacitor erin. Pas te zien na een nieuwe tag; debug-APK `apk/fluistervink-0.533-beta.apk`. In dezelfde PR Gradle terug naar 8.14.3: Dependabot (#147) had 9.8.2 gezet, waarmee niets meer bouwde (ook de release-workflow niet); grote Gradle-versies slaat Dependabot nu over.
- In een nieuwe worktree eerst `npm run build` en `npx cap sync android`, en `ANDROID_HOME=~/Library/Android/sdk` (er is geen `local.properties`).
