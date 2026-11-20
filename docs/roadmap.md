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

1. ~~Release naar stable met de offline wachtrij, daarna de kwaliteitsronde~~ (18 nov, #279). Nog de proeven op de telefoon (gebeld worden en oortjes weg, de microfoon van de oortjes; `NOTES.md`).
2. **Tot ongeveer 1 dec:** de aanvraag voorbereiden (`docs/lancering.md`, punt 4): plafond en daglimiet bij OpenAI en Anthropic, feedback van de testers en de testset, de afvinklijst bijwerken, de laatste release een paar dagen laten staan.
3. **Ondertussen, los van de app:** ~~observation.org~~ (18 nov: dezelfde database, zie punt 5) en ~~kosten per actieve gebruiker per week~~ (#277, voor de betaalde laag, punt 6); het wake word: eerste model getraind, geparkeerd tot na de release (#290, gesloten 19 nov; punt 4).
4. **Na de goedkeuring:** de stabiele AAB naar Productie; opnemen met het scherm uit mergen en taggen (verklaring microfoon); dan de microfoon delen en het wake word in de app, eerst als proef die alleen logt.

## Lopende plannen

| Plan | Stand (16 nov) |
| --- | --- |
| `docs/lancering.md` | gesloten test loopt; testers werven |
| `docs/roadmap-android.md` | stap 1 (volumeknop, standaard aan) en 2 (gesproken bevestiging, proef voor iedereen, standaard uit) gebouwd; stap 3 en 5 na de productierelease |
| `docs/plan-trektelmodus.md` | gebouwd, proef met tester Maarten; vervolg na de proef |
| `docs/plan-ios.md` | voorstel, nog niet goedgekeurd; pas na de lancering in Play |
| `docs/plan-engels.md` | voorstel 19 nov, nog niet goedgekeurd; na de betaalde laag |
| `docs/plan-andere-landen.md` | uitgewerkt 20 nov, voor later; eerst West-Europa. Proef Spanje gedaan |

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
7. **Vogels van andere landen**, gewoon in het Nederlands (regiolijsten van waarneming.nl, `docs/plan-andere-landen.md`). Eerst West-Europa (België, Duitsland, Frankrijk, Luxemburg, VK, dan Spanje, Portugal, Zwitserland, Oostenrijk, Italië); het land hoort bij de sessie, lijsten komen als bestand van de site. De tropen niet in het Nederlands. Dezelfde lijsten maken later ook namen in andere talen mogelijk.
8. **De app in het Engels** (`docs/plan-engels.md`): één app met een taalkeuze, geen tweede app. Teksten, Engelse prompt en soortnamen, Engelse bijnamen. Het meeste werk is een Engelse testset met Engelstalige sprekers. Eerst voor Engelstaligen in Nederland en België (de Nederlandse lijst klopt voor hen), daarna samen met punt 7 voor andere landen.

**Ooit:** iPhone-app (`docs/plan-ios.md`); eventueel BirdNET op de telefoon voor soortsuggesties.

## Kader: landen en talen (20 nov)

Fluistervink blijft bewust gericht op waarneming.nl: "inspreken en thuis met één klik naar waarneming.nl" is een scherp verhaal voor een duidelijke groep, en elk land of elke taal vermenigvuldigt het werk (soortenlijst, bijnamen, zeldzaamheid, prompt, testset met sprekers, export, uitleg, support). We breiden uit in ringen, en pas naar de volgende als de vorige zich bewezen heeft:

1. **Nederland, in het Nederlands (nu).** Bewijzen dat de app aanslaat.
2. **Nederlandse vogelaars in het buitenland.** observation.org is dezelfde database en dekt Europa, dus dezelfde werkwijze en export; regiolijsten (punt 7, proef Spanje). Weinig extra werk, dezelfde mensen.
3. **Engelstaligen in Europa,** via observation.org en eBird (punt 8). Na de betaalde laag, en pas als er vraag naar is.
4. **Noord-Amerika.** Een aparte beslissing, eigenlijk een nieuw product op dezelfde motor: eBird voorop (eigen taxonomie, checklists met inspanning), Amerikaans Engels in de herkenning, en alleen samen met de iPhone-app. Niet zonder bewijs uit ring 1–3.

**Signalen om een ring verder te gaan**, vooraf afgesproken zodat het een besluit is en geen geleidelijke verschuiving: een groep gebruikers die na een maand of twee nog wekelijks vogelt, kosten per gebruiker die de betaalde laag dekt, en herhaalde vragen van buiten de huidige ring.

**In de code:** wat specifiek is voor waarneming.nl (export, vertaling van codes, de soortenlijst als bron) blijft aan de rand; de kern (wachtrij, acties van het model, sessies) hoort waarneming.nl niet te kennen. Teksten via `t()` en de taal per uitspraak zijn al goedkope verzekeringen. Nu níet: een eigen, landonafhankelijk soort-ID onder de waarneming.nl-ID's (pas bij ring 4; dan is de vertaling naar eBird-codes een begin), een Amerikaanse testset of reclame buiten Nederland.

## Bewust niet

Niet zonder overleg (zie ook `CLAUDE.md`, MVP-scope): GPS-track (ook later niet), accounts of multi-user. Overweging 8 nov: later hooguit een **optioneel** account, alleen als iemand daar zelf voor kiest (automatische back-up, nieuwe telefoon); standaard blijft gratis en anoniem.

Ook met opzet niet (12 nov): eigen lijsten en statistieken in de app (jaarlijst, lijst per plek, "eerste van dit jaar" in de samenvatting). Fluistervink legt vast en geeft door. Misschien later een samenwerking met vogelchecklist.nl.
