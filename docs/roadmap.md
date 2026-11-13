# Roadmap

Eén overzicht van waar Fluistervink naartoe gaat, met verwijzingen naar de plannen die het uitwerken. Opgezet op 12 nov 2026 uit de roadmap naar v1.0 (13 okt, origineel in `docs/archief/werklog-2026.md`) en de "Latere roadmap" uit `CLAUDE.md`. Wat nog geen plan is, staat in `docs/ideeen.md`; de stand van vandaag in `NOTES.md`.

## v1.0: openbaar in Google Play

Werkdefinitie (13 okt): een vogelaar die je niet persoonlijk begeleidt, kan de app installeren, een hele wandeling gebruiken zonder naar het scherm te kijken, en thuis zonder gedoe naar waarneming.nl exporteren.

**Nu:** de lancering, `docs/lancering.md`: gesloten test met minstens 12 testers gedurende 14 dagen, dan productietoegang aanvragen; openbaar rond begin december. Uploaden en ondertekenen: `docs/google-play.md`; winkelvermelding: `docs/play-store/README.md`.

De vier sporen van 13 okt, met de stand op 12 nov:

1. **Veldgebruik met de native laag** (`docs/plan-capacitor.md`): trillen op de achtergrond en met het scherm uit, foreground service, Play (interne en gesloten test), volumeknop als inspreekknop: klaar. Opnemen met het scherm uit: na de productierelease (`docs/roadmap-android.md`, stap 3).
2. **Herkenning breder bewijzen:** meer sprekers en omgevingen via de testers; testset van 401 opnames van vier sprekers (6 nov), overgestapt op `gpt-transcribe`. Blijft doorlopen met elke feedback-pull.
3. **Klaar voor vreemden:** twee omgevingen (`docs/omgevingen.md`), aanmelden zonder code (`docs/plan-laagdrempelig.md`), welkom voor nieuwelingen, back-up bij Instellingen: klaar.
4. **Thuis meer waarde dan alleen exporteren:** kaart met clusters, snel nalopen (onzekere één voor één, "Alles klopt"), samenvatting van een sessie: klaar.

## Lopende plannen

| Plan | Stand (12 nov) |
| --- | --- |
| `docs/lancering.md` | gesloten test loopt; testers werven |
| `docs/roadmap-android.md` | stap 1 (volumeknop) en 2 (gesproken bevestiging, ontwikkeloptie) gebouwd; stap 3 en 5 na de productierelease |
| `docs/plan-ebird.md` | fase 1 en fase 2 deel 1 gebouwd (ontwikkeloptie); eerst een echte import bij eBird |
| `docs/plan-trektelmodus.md` | gebouwd, proef met tester Maarten; vervolg na de proef |
| `docs/plan-soortgroepen.md` | voorstel (13 nov): zoogdieren, dagvlinders en libellen |
| `docs/plan-ios.md` | voorstel, nog niet goedgekeurd; pas na de lancering in Play |

Afgerond en alleen nog naslag: `docs/plan-capacitor.md` (fase 0–2 en 4; fase 3 loopt nu via `docs/roadmap-android.md`), `docs/plan-laagdrempelig.md`.

## Na v1.0

- **Opnemen met het scherm uit** en starten met de knop op de oortjes (`docs/roadmap-android.md`, stap 3; gevraagd door Maarten voor op de fiets).
- **Wake word "Fluistervink"**, open source (openWakeWord), na stap 3 (`docs/roadmap-android.md`, stap 5).
- **De microfoon delen:** automatisch pauzeren en hervatten als een andere app (Merlin) de microfoon gebruikt (`AudioRecordingCallback`, stap 4). De trektelling pauzeert al als de app naar de achtergrond gaat.
- **iPhone-app** (`docs/plan-ios.md`).
- Later: offline wachtrij met sync-status; inzenden via de API van waarneming.nl (OAuth, client-ID aanvragen; uitgezocht in `docs/ideeen.md`); eventueel BirdNET op de telefoon voor soortsuggesties.

## Bewust niet

Niet zonder overleg (zie ook `CLAUDE.md`, MVP-scope): GPS-track (ook later niet), accounts of multi-user. Overweging 8 nov: later hooguit een **optioneel** account, alleen als iemand daar zelf voor kiest (automatische back-up, nieuwe telefoon); standaard blijft gratis en anoniem.

Ook met opzet niet (12 nov): eigen lijsten en statistieken in de app (jaarlijst, lijst per plek, "eerste van dit jaar" in de samenvatting). Fluistervink legt vast en geeft door. Misschien later een samenwerking met vogelchecklist.nl.
