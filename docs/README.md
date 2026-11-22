# Documentatie

Wat waar staat. Ontwerp en werkafspraken staan in `CLAUDE.md` in de hoofdmap, de stand van vandaag in `NOTES.md`, installeren en ontwikkelen in de `README.md`.

## Ontwerp

- `ontwerp.md`: de uitwerking van de keuzes in `CLAUDE.md` per onderwerp, met de plekken in de code.

## Richting

- `roadmap.md`: waar de app naartoe gaat, met de stand per plan.
- `ideeen.md`: ideeën die nog geen plan zijn (eerst overleggen).
- `lancering.md`: de weg naar openbaar in Google Play (v1.0), met afvinklijst.

## Plannen

Elk plan begint met datum en status. De code verwijst ernaar, dus de bestandsnamen blijven staan, ook als een plan af is.

| Plan | Status |
| --- | --- |
| `plan-capacitor.md` | de native laag; fase 0–2 en 4 klaar, fase 3 loopt via `roadmap-android.md` |
| `plan-laagdrempelig.md` | aanmelden zonder code; klaar, naslag voor het instellen |
| `plan-trektelmodus.md` | trektelmodus; gebouwd, proef met tester Maarten; met het scherm uit als proef in de beta (18 nov) |
| `roadmap-android.md` | vogelen zonder naar de telefoon te kijken, vijf stappen; stap 1–2 gebouwd |
| `plan-ebird.md` | inspanning en export naar eBird; afgerond 16 nov (keuze "Ik gebruik eBird" bij Instellingen) |
| `plan-soortgroepen.md` | zoogdieren, reptielen en amfibieën, dagvlinders en libellen inspreken; afgerond 16 nov (voor iedereen, standaard aan) |
| `plan-insecten.md` | insecten inspreken: vangnet per groep met opzoeken (nu), korte lijst opvallende soorten in de prompt (april); goedgekeurd 22 nov; laag 1 gebouwd als ontwikkeloptie `insecten` |
| `plan-offline.md` | offline wachtrij: zonder bereik doorvogelen, vanzelf verwerken; afgerond, op stable sinds 18 nov |
| `plan-ios.md` | iPhone-app; voorstel, na de lancering |
| `plan-engels.md` | de app in het Engels: één app met een taalkeuze; voorstel 19 nov, na de betaalde laag; stap 1 (woordenboek), 2 (Engelse namen) en 3 (ontwikkeloptie "English") gedaan, van 5 de schermen |
| `plan-andere-landen.md` | soortenlijsten van andere landen en namen in andere talen; uitgewerkt 20 nov, voor later (eerst West-Europa); proef Spanje gedaan |
| `plan-tuintelling.md` | Nationale Tuinvogeltelling (eind jan 2027): telmodus en promotie; uitzoekwerk gedaan (geen import, overtypen); kern gebouwd als ontwikkeloptie (21 nov) |
| `plan-robuustheid.md` | edge cases die een tester zou proberen, en hoe we ze blijvend afdekken; code klaar, nog proberen op de telefoon en testset-opnames |
| `plan-afschermen.md` | afschermen en embargo met de stem, mee naar waarneming.nl; besloten 22 nov (feedback van een tester), in aanbouw |

## Naslag

- `omgevingen.md`: beta en stabiel, een release naar stable.
- `google-play.md`: ondertekenen, taggen en uploaden naar Play.
- `play-store/`: winkelvermelding, gegevensveiligheid, schermafbeeldingen.
- `waarneming-nl.md`: importformaat, soortenlijst en codes van waarneming.nl.
- `proxy.md`: de proxy: toegang, kosten, statistieken en wat testers delen.
- `kwaliteitsronde.md`: de periodieke ronde over de hele codebase, met logboek.
- `draaiboek-thuis.md`, `draaiboek-buiten.md`, `draaiboek-telling.md`: proeven op de telefoon om af te vinken (22 nov): thuis aan tafel, buiten met oortjes en testset-opnames, trektelling met het scherm uit en tuintelling.
- `beheer.md`: API-sleutels, weetjes bij het bouwen van de Android-app, de branch-regel op `main`.

## Archief

Afgerond, alleen nog om terug te lezen.

- `archief/mijlpaal-mvp.md`: de beoordeling van de MVP (12 okt).
- `archief/veldtests.md`: bevindingen uit de eerste veldtests (9–12 okt).
- `archief/werklog-2026.md`: de oude stand uit `NOTES.md` (13 okt – 18 nov).
- `archief/kwaliteitsronde-logboek.md`: oudere regels uit het logboek van de kwaliteitsronde (24 okt – 11 nov).
