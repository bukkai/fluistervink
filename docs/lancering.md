# Lancering in Google Play (v1.0)

Roadmap van 8 nov 2026: van de interne test naar Fluistervink openbaar in de Play Store. Hoe uploaden en ondertekenen werkt, staat in `docs/google-play.md`; dit document is de volgorde en wat er nog moet.

## De regel van Google

Een persoonlijk ontwikkelaarsaccount dat na november 2023 is aangemaakt, mag pas naar productie na een **gesloten test met minstens 12 testers die 14 dagen onafgebroken aangemeld zijn**. Daarna vraag je productietoegang aan (een vragenlijst over de test); de beoordeling duurt meestal tot een week.

- "Aangemeld" = via de deelnamelink tester geworden. Elke dag de app openen hoeft niet; afmelden zet de teller van die tester terug.
- Het gaat om 12 tegelijk: wie later instapt, telt 14 dagen vanaf dan. Neem er 15 à 20.
- Gebruik telt niet voor de teller, maar wel bij de aanvraag (hoe gevonden, hoe gebruikt, welke feedback, wat ermee gedaan). Echte sessies en gedeelde feedback helpen dus.
- Nieuwe versies tijdens de test mogen: de teller hoort bij de testers, niet bij de versie. Releases in de gesloten test worden wel door Google beoordeeld (uren tot dagen), de interne test niet.
- Het dashboard in de Play Console toont de stand.

Grove planning: gesloten test vanaf ~10 nov, aanvragen ~24 nov, openbaar rond begin december.

## 1. Nu (vóór en tijdens de start van de gesloten test)

Eigenaar:

- [x] `npm run release`: welkom (#168) en back-up (#167) naar `fluistervink.nl`.
- [x] Play Console → Testen → **Gesloten tests**: track aanmaken (bv. "Stabiel"), de stabiele AAB van de laatste tag uploaden en uitrollen (`docs/google-play.md`, Een nieuwe versie).
- [x] Deelnamelink van die track: `https://play.google.com/apps/testing/nl.hegmus.fluistervink`. Winkelpagina (pas zichtbaar na deelnemen): `https://play.google.com/store/apps/details?id=nl.hegmus.fluistervink`.
- [x] 15–20 testers werven (12 sinds 17 nov, genoeg voor de regel van Google) (Gmail-adressen in de lijst van de gesloten test) en de deelnamelink sturen; een code is niet meer nodig.
- [x] Contactadres voor de Play Store en de privacypagina: `info@fluistervink.nl` (bestaat sinds 9 nov).
- [x] Plafond en daglimiet bij OpenAI en Anthropic: ingesteld op 18 nov. De proxy begrenst elke installatie (ook het model per dag, `docs/proxy.md`); het plafond bij de aanbieders is het vangnet.

Claude (in PR's):

- [x] **Privacypagina als losse pagina** (`/privacy`), uit dezelfde bron als `#privacy`, zodat Google hem kan lezen zonder JavaScript. Plus wat de Play-regels vragen: wie de app maakt, contact, hoe lang gegevens blijven, je rechten (AVG).
- [x] **Teksten voor de winkelvermelding** in `docs/play-store/README.md`: korte beschrijving (80 tekens), lange beschrijving (tot 4000), categorie. Noem de native functies (trillen met scherm uit, melding tijdens een sessie): Google wijst apps die alleen een website tonen soms af.
- [x] **Antwoorden voor Gegevensveiligheid** (`docs/play-store/README.md`), uit de code afgeleid: audio, precieze locatie, installatie-id, app-activiteit, diagnose (log); verwerkers OpenAI, Anthropic, Cloudflare, Google (Play Integrity); versleuteld onderweg; wissen via feedback.
- [x] **Tekst voor de verklaring Foreground service** (`FOREGROUND_SERVICE_LOCATION`, in `docs/play-store/README.md`, met een draaiboek voor de video): waarom, wat de gebruiker ziet. De video (een sessie met de melding, niet-openbaar op YouTube) neemt de eigenaar op.
- [x] **Schermafbeeldingen** (`docs/play-store/screenshots/`, `npm run play-screenshots`; minstens 2, staand) van de stabiele versie op telefoonformaat, met voorbeeldgegevens.

## 2. Play Console invullen (Dashboard → App instellen)

Afgevinkt op 18 nov: zonder deze stappen laat de Play Console een gesloten test niet uitrollen, en die loopt sinds 9 nov. Bij de aanvraag voor productie nog een keer langs het dashboard.

- [x] Winkelvermelding: naam "Fluistervink", teksten, pictogram 512×512, feature graphic 1024×500, schermafbeeldingen, contactadres.
- [x] Privacybeleid: `https://fluistervink.nl/privacy`.
- [x] Gegevensveiligheid, contentclassificatie (vragenlijst), doelgroep (13+ of 18+, niet kinderen: anders gelden de gezinsregels), advertenties: nee, app-toegang: alles zonder inloggen.
- [x] Verklaring foreground service, met video.
- [x] Landen: Nederland en België voor de gesloten test (19 nov). Voor productie kan het pas bij het maken van de release (zie punt 5).

## 3. Logo

Wordt ontwikkeld, komt waarschijnlijk in januari, dus na de lancering. Een nieuw pictogram is een native wijziging: nieuwe tag en beide AAB's uploaden. Mag tijdens de gesloten test; laat de start er niet op wachten.

Vragen aan de artiest:

- Vector (SVG), vierkant, **zonder tekst**, herkenbaar op 48 px.
- Twee lagen voor het Android-pictogram: voorgrond en effen achtergrond. Android knipt het rond, vierkant of als druppel bij; het belangrijke deel binnen de middelste ~60%.
- Een effen silhouet in één kleur: meldingsbalk (`ic_stat_vink`) en de gekleurde pictogrammen van Android 13.

Daaruit maken we: Android-pictogram (`android/app/src/main/res/mipmap-*`, adaptief), splash, `public/icon.svg`, `icon-192/512.png`, `apple-touch-icon.png`, Play-pictogram 512 px en de feature graphic.

## 4. Vóór de aanvraag voor productie

Wat met de lancering meegaat en wat achter een schakelaar wacht: `docs/vrijgave.md`.

- [x] **Kwaliteitsronde** (`docs/kwaliteitsronde.md`): gedaan na de release van 18 nov (#279), plus de architectuurronde (#280–#283).
- [x] Feedback van de testers ophalen en verwerken (`npm run feedback -- pull` en `notes`), zodat er iets te vertellen is bij de aanvraag: gaat regelmatig. Testers gevraagd om nog wat in te dienen (21 nov). Vlak voor de aanvraag nog één keer.
- [x] Laatste release in de gesloten test minstens een paar dagen vóór de aanvraag (beoordeling): v0.4 goedgekeurd, stable bijgewerkt op 21 nov. Mogelijk nog een v0.5 vóór 1 dec, afhankelijk van de proeven; die dan op tijd indienen.
- [ ] Na die laatste release naar stable de testers een mail sturen: de nieuwste versie binnenhalen (bijwerken in Play) en, als ze de app geprobeerd hebben, nog feedback indienen. Daarna de feedback vlak voor de aanvraag ophalen (punt hierboven).

## 5. Productie

- [x] Vóór de productierelease: daglimiet van het model per installatie naar 500 per dag (22 nov, `docs/plan-marketing.md`, Kostengrens per stap).
- [ ] Productietoegang aanvragen in de Play Console (na 14 dagen, als het dashboard het toestaat).
- [ ] Na goedkeuring: de stabiele AAB naar **Productie**. Bij het maken van die release de landen kiezen: Nederland en België. De beta blijft in de interne test.
- [ ] Zodra de app openbaar in Play staat: op de voorpagina (`index.html`) de zin onder "Open de app" wordt "Werkt in de browser van je telefoon. Op Android ook als app: Fluistervink in Google Play", met een link naar `https://play.google.com/store/apps/details?id=nl.hegmus.fluistervink` (eerder als draft #333, gesloten op 22 nov; opnieuw klaar in de PR "Play-link op de voorpagina", mergen zodra de app openbaar is). Daarvóór geeft die link wie geen tester is een "niet gevonden". Tot dan gaan nieuwe testers met de hand op de e-maillijst van de gesloten test.
- [ ] `#uitleg` en `#privacy` nalopen op "test"-taal; `CLAUDE.md` en `NOTES.md` bijwerken. Nagelopen op 18 nov: beide schoon (alleen de gesproken bevestiging heet er een proef, en dat is hij nog). Besloten 21 nov: "(proef)" bij Trektelmodus eraf (gesproken bevestiging blijft een proef); "nog in ontwikkeling" in de vraag om te delen (welkom en startscherm) blijft tijdens de test en verandert vóór de productierelease: klaar in de PR "nog in ontwikkeling" (wordt "nieuw"), mergen zodra de productietoegang er is.
- [ ] De eerste weken Statistieken en Kosten op Developer volgen.
- [ ] Naam in de winkelvermelding: "Fluistervink: vogels inspreken" (`docs/play-store/README.md`).
- [ ] Bekendheid geven in stappen, eerst in eigen kring: `docs/plan-marketing.md`.

## 6. Na de productierelease: testers die er zelf voor kiezen

Plan: `docs/plan-testers.md`.

- [ ] De gesloten test "Stabiel" uitfaseren: geen nieuwe releases meer, lijst leeg, de testers een bedankmail (stap 1 van het plan).
- [ ] Google Group (alleen mededelingen) en een nieuwe gesloten track "Beta" met de beta-AAB (stap 2).
- [ ] **Uitproberen met het tweede account**, zodra "Beta" er is: eerst via de link van de interne test "Programma verlaten" (het account is daar sinds 18 nov tester), de app verwijderen en Fluistervink uit productie installeren. Dan lid worden van de groep, tester worden van "Beta" en kijken of Play de app bijwerkt naar de beta of dat verwijderen nodig is. Ook nagaan of de back-up van stabiel goed terugkomt in de beta. De uitkomst bepaalt de stappen op de kaart (stap 4 van het plan).

Later, niet nodig voor de lancering: automatisch uploaden vanuit de workflow.
