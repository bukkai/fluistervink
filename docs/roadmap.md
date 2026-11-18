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

## Komende stappen (18 nov)

1. **Deze week:** de laatste proeven op de telefoon (plek die later komt, gebeld worden en oortjes weg, de regel over de microfoon van de oortjes), dan een release naar stable, zodat de testers de offline wachtrij nog tijdens de gesloten test krijgen. Direct daarna de kwaliteitsronde (`docs/kwaliteitsronde.md`), ook een voorwaarde vóór de aanvraag voor productie.
2. **Tot ongeveer 1 dec:** de aanvraag voorbereiden (`docs/lancering.md`, punt 4): plafond en daglimiet bij OpenAI en Anthropic, feedback van de testers en de testset, de afvinklijst bijwerken, de laatste release een paar dagen laten staan.
3. **Ondertussen, los van de app:** ~~nagaan of observation.org dezelfde bulkimport heeft~~ (18 nov: dezelfde database, zie punt 5); de kosten per actieve gebruiker per week zichtbaar maken in Developer en Statistieken, voor de keuze over de betaalde laag (punt 6); daarna het wake word trainen met openWakeWord en meten op de testset (punt 4).
4. **Na de goedkeuring:** de stabiele AAB naar Productie; opnemen met het scherm uit mergen en taggen (verklaring microfoon); dan de microfoon delen en het wake word in de app, eerst als proef die alleen logt.

## Lopende plannen

| Plan | Stand (16 nov) |
| --- | --- |
| `docs/lancering.md` | gesloten test loopt; testers werven |
| `docs/roadmap-android.md` | stap 1 (volumeknop, standaard aan) en 2 (gesproken bevestiging, proef voor iedereen, standaard uit) gebouwd; stap 3 en 5 na de productierelease |
| `docs/plan-trektelmodus.md` | gebouwd, proef met tester Maarten; vervolg na de proef |
| `docs/plan-ios.md` | voorstel, nog niet goedgekeurd; pas na de lancering in Play |

Afgerond en alleen nog naslag: `docs/plan-capacitor.md` (fase 0–2 en 4; fase 3 loopt nu via `docs/roadmap-android.md`), `docs/plan-laagdrempelig.md`, `docs/plan-ebird.md` (16 nov), `docs/plan-soortgroepen.md` (16 nov: voor iedereen, standaard aan).

## Na v1.0

Volgorde besloten op 17 nov. Alles komt eerst achter een ontwikkeloptie op `main` (werkwijze tijdens de proef: `docs/omgevingen.md`).

**Eerst: vogelen zonder netwerk en zonder scherm.**

1. **Offline wachtrij** (`docs/plan-offline.md`): een uitspraak zonder bereik blijft wachten en wordt vanzelf verwerkt zodra er weer verbinding is, met een zichtbare stand ("3 uitspraken wachten op bereik"). Gebouwd op 17 nov; voor iedereen na de proeven in het veld.
2. **Opnemen met het scherm uit** en starten met de knop op de oortjes (`docs/roadmap-android.md`, stap 3; gevraagd door Maarten voor op de fiets). Vraagt een nieuwe verklaring bij Google (microfoon in de service), dus: de proef nu op een eigen branch met een debug-APK, op `main` en in een tag pas na de productierelease.
3. **De microfoon delen** met Merlin en bellen (`AudioRecordingCallback`, stap 4), nodig voor het wake word.
4. **Wake word "Fluistervink"**, open source (openWakeWord, stap 5). Het model trainen en meten op de opnames uit de testset kan al eerder, los van de app; in de app pas na stap 2 en 3, eerst een proef die alleen logt.

**Daarna: breder en betaalbaar.**

5. **Export naar observation.org**: nagegaan 18 nov (`docs/waarneming-nl.md`, "observation.org"): dezelfde database als waarneming.nl, dus een import bij waarneming.nl staat er al. Alleen voor Engelstaligen nodig: gedrag, methode, kleed en telmethode in het Engels (bij punt 8). Ook trektellen.nl (import nog uitzoeken). iNaturalist als laatste (zonder foto of geluid telt een waarneming daar nauwelijks). Inzenden via de API van waarneming.nl pas als er meer gebruikers zijn.
6. **Betaalde laag**, vóór het aantal gebruikers flink groeit. Eerst de kosten per actieve gebruiker meten (de proef van 17 nov–1 dec, Developer en Statistieken). Dan Play Billing (verplicht voor digitale extra's in een Android-app): de aankoop hangt aan het Google-account, de proxy controleert hem en koppelt hem aan het installatietoken, dus geen eigen accounts. Denkrichting: gratis met een plafond per dag, betaald een ruimer plafond en de trektelmodus. Native, dus een nieuwe app-versie; voorwaarden en `#privacy` erbij.
7. **Vogels van andere landen**, gewoon in het Nederlands (regiolijsten van observation.org, `docs/ideeen.md`).
8. **De app in het Engels**: teksten, Engelse prompt en soortnamen, Engelse bijnamen. Het meeste werk is een Engelse testset met Engelstalige sprekers.

**Ooit:** iPhone-app (`docs/plan-ios.md`); eventueel BirdNET op de telefoon voor soortsuggesties.

## Bewust niet

Niet zonder overleg (zie ook `CLAUDE.md`, MVP-scope): GPS-track (ook later niet), accounts of multi-user. Overweging 8 nov: later hooguit een **optioneel** account, alleen als iemand daar zelf voor kiest (automatische back-up, nieuwe telefoon); standaard blijft gratis en anoniem.

Ook met opzet niet (12 nov): eigen lijsten en statistieken in de app (jaarlijst, lijst per plek, "eerste van dit jaar" in de samenvatting). Fluistervink legt vast en geeft door. Misschien later een samenwerking met vogelchecklist.nl.
