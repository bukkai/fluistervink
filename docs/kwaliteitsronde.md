# Kwaliteitsronde

Af en toe de hele codebase na: veiligheid, opbouw van de code, toegankelijkheid en gebruik in het veld. Niet bij elke PR, en ook niet vlak vóór een release naar stable.

## Wanneer

**Direct na een release naar stable** (`npm run release`), op de beta. De verbeteringen lopen dan een paar weken mee in echte wandelingen en gaan met de volgende release naar stable. Een ronde vlak vóór de release zou juist de nieuwste, ongeteste wijzigingen naar stable sturen.

`npm run release` laat zien wanneer de laatste ronde was en hoeveel commits er sindsdien zijn; na zes weken vraagt hij of je toch wilt doorgaan.

Daarnaast een ronde, ook als de vorige nog niet zo lang geleden is:

- voordat er een nieuwe groep mensen bij komt (de eerste gebruikers op stable, een gesloten test in Play);
- als gegevens een nieuwe kant op gaan (nieuwe API, nieuwe opslag, nieuwe rechten op Android): dan in elk geval stap 1 en 5;
- vóór de productie-release in Play en vóór v1.0.

## Wat er altijd al gebeurt

- **Elke PR** (`.github/workflows/check.yml`): opmaak, typecheck, tests, proefbuild, en `npm audit` op de pakketten die meegaan naar de telefoon en de Worker (hoog of kritiek = rood).
- **Dependabot** (`.github/dependabot.yml`): elke maandag een PR met updates van npm-pakketten (klein gebundeld), GitHub Actions en Gradle; bij een bekend lek meteen.
- **Op afspraak** (`CLAUDE.md`): `veldtest-review` na wijzigingen aan het wandelscherm; `/security-review` en `#privacy` bijwerken bij wijzigingen aan de proxy of een nieuwe plek waar gegevens heen gaan.

## De ronde

In deze volgorde, op een eigen branch vanaf `main`. Elke stap levert bevindingen op; repareer wat duidelijk is in kleine PR's, de rest gaat naar het logboek hieronder (en zo nodig naar de open punten in `NOTES.md`).

1. **Veiligheid:** `/security-review` over de hele codebase, niet alleen de laatste wijziging. Let vooral op de proxy (`worker/index.ts`: toegangscodes, wat het doorgeeft aan Anthropic en OpenAI, limieten), de JSON-import (`checkImport`), de CSP in `public/_headers` en `innerHTML`. Daarnaast `npm audit` (ook ontwikkelpakketten) en de open Dependabot-meldingen.
2. **Code:** `/code-review` en `/simplify` over de hele codebase: fouten, dubbele code, wat overbodig is geworden.
3. **Toegankelijkheid en UX:** de schermen langs met de browser (wandeling, nalopen, wandelingen, instellingen): contrast, knopgroottes, labels voor schermlezers, toetsenbord, foutmeldingen in gewone taal.
4. **In het veld:** de skill `veldtest-review` (één hand, handschoenen, zon, slecht bereik).
5. **Teksten tegen de code:** kloppen `#privacy` (waar gegevens heen gaan, met bronnen en datum van het beleid van de aanbieders) en `#uitleg` (trilpatronen, voorbeelden) nog? En `CLAUDE.md`?
6. **Afsluiten:** een regel in het logboek, met de commit van `main` waarop de ronde begon.

## Logboek

Nieuwste bovenaan. `npm run release` leest de bovenste regel (datum en commit), dus houd die vorm aan.

| Datum | Commit | Gevonden en opgelost | Bewust laten liggen (waarom) |
| --- | --- | --- | --- |
| 2026-10-24 | fbd31fb | Proxy zonder snelheidslimiet (#121, 60/min per tester op AI); Content-Type van gedeelde bestanden door tester te kiezen (#121); aantal en "erbij" niet als heel getal gecontroleerd, geslacht niet (#122); "Weg" 4,49:1 (#123, nu 5,02); `#privacy` miste de afstand naar Anthropic en de Google Maps-links (#123) | happy-dom (hoog lek, alleen tests): Dependabot #120; TypeScript 7 (#119) faalt in de check, apart bekijken; Inspreken-knop staat in de bovenste helft (buiten de duimzone), vraagt een andere indeling: eerst overleggen; kleine doelen thuis ("±8 m" 31×19 px, filterknop 32 px hoog): niet in het veld nodig; bronnen van `#privacy` (11 okt) niet opnieuw nagekeken: volgende ronde |
