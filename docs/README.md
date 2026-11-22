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

**Lopend** (stand 22 nov):

| Plan | Status |
| --- | --- |
| `roadmap-android.md` | vogelen zonder naar de telefoon te kijken, vijf stappen; stap 1–2 gebouwd, stap 3 (scherm uit) als proef in de beta, de rest na de productierelease |
| `plan-trektelmodus.md` | trektelmodus; gebouwd, proef met tester Maarten; met het scherm uit als proef in de beta (18 nov) |
| `plan-tuintelling.md` | Nationale Tuinvogeltelling (29–31 jan 2027): kern gebouwd als ontwikkeloptie (21 nov); gesprekken met Vogelbescherming week van 23 nov |
| `plan-insecten.md` | insecten inspreken: vangnet per groep met opzoeken (nu), korte lijst opvallende soorten in de prompt (april); laag 1 gebouwd als ontwikkeloptie `insecten` (22 nov) |
| `plan-robuustheid.md` | edge cases die een tester zou proberen; code klaar, nog een paar gevallen op de telefoon en in de testset |
| `plan-engels.md` | de app in het Engels; stap 1–3 en de schermen van stap 5 gedaan (ontwikkeloptie "English"); volgende: Engelse testset, na de betaalde laag |

**Voor later:**

| Plan | Status |
| --- | --- |
| `plan-andere-landen.md` | soortenlijsten van andere landen en namen in andere talen; uitgewerkt 20 nov, eerst West-Europa; proef Spanje gedaan |
| `plan-jaarrond-tuintelling.md` | de tuintelmodus ook voor de Jaarrond Tuintelling van Sovon (vrije duur, overvliegers mee); voorstel 22 nov, na de tuintelling van januari |
| `plan-ios.md` | iPhone-app; voorstel, na de lancering |
| `plan-marketing.md` | Fluistervink bekend maken na de lancering: in stappen vanwege de kosten, grote push rond de tuintelling; titel, filmpje en december besloten 22 nov, kostengrens een voorstel |

**Afgerond, naslag:**

| Plan | Status |
| --- | --- |
| `plan-capacitor.md` | de native laag; fase 0–2 en 4 klaar, fase 3 loopt via `roadmap-android.md` |
| `plan-laagdrempelig.md` | aanmelden zonder code; naslag voor het instellen |
| `plan-ebird.md` | inspanning en export naar eBird; afgerond 16 nov (keuze "Ik gebruik eBird" bij Instellingen) |
| `plan-soortgroepen.md` | zoogdieren, reptielen en amfibieën, dagvlinders en libellen; afgerond 16 nov (voor iedereen, standaard aan) |
| `plan-offline.md` | offline wachtrij; afgerond, op stable sinds 18 nov |
| `plan-afschermen.md` | afschermen en embargo met de stem, mee naar waarneming.nl; gebouwd en proefgeïmporteerd 22 nov, embargo weghalen met de stem in #345 |

## Naslag

- `omgevingen.md`: beta en stabiel, een release naar stable.
- `google-play.md`: ondertekenen, taggen en uploaden naar Play.
- `play-store/`: winkelvermelding, gegevensveiligheid, schermafbeeldingen.
- `waarneming-nl.md`: importformaat, soortenlijst en codes van waarneming.nl.
- `proxy.md`: de proxy: toegang, kosten, statistieken en wat testers delen.
- `kwaliteitsronde.md`: de periodieke ronde over de hele codebase, met logboek.
- `draaiboek-thuis.md`, `draaiboek-buiten.md`, `draaiboek-telling.md`: proeven op de telefoon om af te vinken: thuis aan tafel (gedaan 22 nov, op de kinderstem na), buiten met oortjes en testset-opnames, trektelling met het scherm uit en tuintelling.
- `beheer.md`: API-sleutels, weetjes bij het bouwen van de Android-app, de branch-regel op `main`, twee sessies tegelijk.

## Archief

Afgerond, alleen nog om terug te lezen.

- `archief/mijlpaal-mvp.md`: de beoordeling van de MVP (12 okt).
- `archief/veldtests.md`: bevindingen uit de eerste veldtests (9–12 okt).
- `archief/werklog-2026.md`: de oude stand uit `NOTES.md` (13 okt – 22 nov).
- `archief/kwaliteitsronde-logboek.md`: oudere regels uit het logboek van de kwaliteitsronde (24 okt – 11 nov).
