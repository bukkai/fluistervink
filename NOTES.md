# Stand van zaken

Werklog om tussen computers te schakelen: alleen wat nu speelt en wat nog moet. Lees het aan het begin van een sessie en werk het bij aan het eind. Houd het kort: is een onderwerp af, haal het hier weg (de PR's op GitHub vertellen wat er gebeurde; een langere geschiedenis kan naar `docs/archief/werklog-2026.md`).

Waar de rest staat: ontwerp en afspraken in `CLAUDE.md`, de richting in `docs/roadmap.md`, ideeën in `docs/ideeen.md`, sleutels, Android-weetjes en de branch-regel op `main` in `docs/beheer.md`, een overzicht van alle documenten in `docs/README.md`.

## Nu (22 nov)

- **Lancering in Play** (`docs/lancering.md`): gesloten test met 12 testers sinds 17 nov, tot ongeveer 1 dec, daarna productietoegang aanvragen. Testers op stable, de eigenaar op de beta. De proxy begrenst elke installatie per dag (#278: spraak 5 uur, model 1500 verzoeken); bijstellen met de kosten per gebruiker op Developer (#277). Feedback uit Discord (letterlijk, plus overzicht per tester met wat ermee gedaan is) in `testset/feedback/discord/`, buiten git; testers gevraagd nog wat in te dienen (21 nov). Gesloten en interne test op v0.6 (8577151, goedgekeurd 22 nov). Vanaf v0.7 de releasenaam in Play gelijk aan de tag (#331). "Nog in ontwikkeling" pas vóór productie aanpassen; logo waarschijnlijk januari. In de Play Console nagaan: adressen van de interne lijst ook in de gesloten lijst, interne lijst leeg op de eigenaar na (#252, `docs/google-play.md`). Nieuwe testers tot productie met de hand op de e-maillijst.
- **Plan komende weken** (ook in `docs/roadmap.md`): (1) proeven op de telefoon (hieronder); (2) tot ~1 dec de aanvraag voorbereiden: feedback en testset, afvinklijst in `docs/lancering.md`; (3) na goedkeuring: AAB naar Productie. Native proeven kunnen al eerder in de beta: volgende is de trektelling met het scherm uit, daarna microfoon delen en het wake word als proef die alleen logt.
- **Werkwijze tijdens de proef:** nieuwe functies op `main`, liefst achter een ontwikkeloptie; `npm run release` alleen als `main` mee mag, anders een hotfix (`docs/omgevingen.md`). Native code die nog niet mee mag: alleen de beta-AAB uploaden. Stable staat op 0c31293 (release 21 nov); de kwaliteitsronde #319 gaat met de volgende release mee.
- **Tuintelling** (`docs/plan-tuintelling.md`): Nationale Tuinvogeltelling 29–31 jan 2027; kern gebouwd als ontwikkeloptie. Nog: de woorden van beginners met opnames meten ("duif", "mus", "mees"), de volgorde in hun formulier als het in januari opengaat. Contact met Vogelbescherming: week van 23 nov gesprekken met de social media manager en een developer (vragen in het plan, punt 4). Daarna besluiten over de telmodus; open beslissingen onderaan het plan.
- **Afschermen en embargo** (`docs/plan-afschermen.md`): gebouwd en op de telefoon goed; embargo weghalen met de stem in #345 (open).
- **Insecten** (`docs/plan-insecten.md`): laag 1 als ontwikkeloptie `insecten`; "een uil" wordt Vogel onbekend tot "Uil onbekend" met de wekelijkse soortenlijst in de prompt komt.
- **Robuustheid** (`docs/plan-robuustheid.md`): de gevallen zijn als tekst geprobeerd; nog open: dubbele undo en redo, correctie meer dan 20 terug, en de drie voor de telefoon. Telefoon vol niet getest (merken we als iemand ertegenaan loopt). Als het zich voordoet: wifi met inlogpagina (#268), en of "Geen bereik, … wachten" nog blijft staan na weer verbinding (#260).
- **Meertalig** (`docs/plan-engels.md`): stap 1–3 en de schermen van stap 5 gemerged. Volgende: stap 4, een Engelse testset met Engelstalige sprekers. Bij een volgende eBird-import nagaan of eBird de namen herkent (minder "Fix Species"). Pas als Engels echt naar productie gaat: de Engelse stem van de gesproken bevestiging (native, `SprekenPlugin.java` moet `taal` lezen; nieuwe app-versie).
- **Microfoon van de oortjes** (#267, native; stable-AAB zonder plugin toont niets): ontwikkeloptie "Microfoon van de oortjes" kiest de headset. Debug-APK `apk/fluistervink-0.783-oortjes-microfoon.apk`. Proberen staat in `docs/draaiboek-buiten.md`; daarna de testset voor wat Bluetooth kost. In Play pas met een nieuwe tag. Open vraag: wil de eigenaar dat de trektelling in de service ook de oortjesmicrofoon gebruikt? Nu neemt die op met de telefoonmicrofoon; dat is native werk (`setPreferredDevice` in `TrektelOpname`).
- **Opnemen met het scherm uit** (#253, v0.4): microfoon in de service alleen in de beta-build. De verklaring Foreground service (microfoon) is goedgekeurd, dus een stabiele AAB mag gewoon naar de gesloten test. De stabiele build haalt de microfoon er nog uit (`android/app/src/stable/AndroidManifest.xml`); weghalen kan pas als scherm uit naar iedereen gaat. Nog in het veld: start-/stoptril met het scherm uit, met een podcast aan.
- **Wake word geparkeerd tot na de release** (#290 gesloten, branch bewaard met `docs/plan-wakeword.md`): eerste model ~73% herkend bij weinig valse meldingen, doel 90% bij ≤ 1/uur; alleen synthetische stemmen is niet genoeg. Na de release testers vragen "Fluistervink" in te spreken. 17 GB kenmerken op deze Mac in `../fluistervink-wakeword/wakeword/data/oww/`.

## Op de telefoon proberen

Uitgeschreven in drie draaiboeken om af te vinken: `docs/draaiboek-thuis.md` (A–F en H gedaan op 22 nov; nog G, de kinderstem, begin december), `docs/draaiboek-buiten.md` (oortjesmicrofoon in drie rondes, sluiterknopje, opnames voor de testset) en `docs/draaiboek-telling.md` (trektelling met het scherm uit en de WebView zichtbaar #312, tuintelling #332, `walk_service_failed`). Bevindingen hier; elk punt dat werkt, ook uit het draaiboek weghalen.

- **Soortveld** (#344): een waarneming onderaan de lijst openen en typen; met het toetsenbord open moeten de eerste suggesties boven Opslaan staan.
- **Trektelling met het scherm uit** (#289, achter `schermUit` in de beta): opnemen werkt, maar Chromium zet de webcode 60 s na het vergrendelen stil, dus de stukken worden pas bij het ontgrendelen verwerkt (niets verloren, wel geen tril). #312 is de volgende proef; de service zelf laten verwerken staat in `docs/ideeen.md`. Bij de volgende telling ook nagaan: geen stukken zonder plek, geen ±200 m meer (#310).
- **Oortjesmicrofoon:** twee rondes gedaan op 21 nov (Hatertse Hei), buiten git in `testset/feedback/oortjesproef/`; nog niet door de testset, dat samen met de rondes uit het draaiboek.
- Bij de volgende import naar waarneming.nl een Bonte Kraai meenemen (#153).

## Met de testset nagaan

- **Nog niet gemeten:** iemand anders die een vogel noemt, radio, wind zonder iets te zeggen, "die buizerd van een kwartier geleden" na veel waarnemingen (robuustheid #6, #7); een paar Latijnse namen (#157). Hiervoor opnames inspreken (draaiboek buiten).
- **Oortjes na een gesprek** (18 nov): de microfoon ging pas na 0,65 s open en het begin van een uitspraak viel weg. Wachten op het starttikje helpt; komt het vaker voor, dan nagaan of de oortjesmicrofoon sneller of warm kan.
- **Opletten, promptregel alleen als het vaker voorkomt:** "die houtduiven" zonder eerdere waarneming is waarschijnlijk "drie houtduiven"; bereik als schatting ("tussen de vijftig en honderd", #215); preciezere leeftijd ("juveniel, ik denk derde kalenderjaar").

## Steeds

- Bij elke nieuwe gedeelde sessie `npm run feedback -- pull`, `npm run feedback -- notes` en `npm run testset`.
- Prompt alleen aanpassen als de testset het laat zien: de meeste echte fouten zitten in de spraakherkenning (korte uitspraken, verward met een andere vogelnaam), niet in het model. Vergelijk testset-runs met `--soortgroepen` als die aan stonden.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen staan niet in git: `.dev.vars` per computer zelf aanmaken (zie README), en `.testers.json` meekopiëren als je testers met het script wilt beheren.
