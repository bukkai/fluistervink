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

- [ ] `npm run release`: welkom (#168) en back-up (#167) naar `fluistervink.nl`.
- [ ] Play Console → Testen → **Gesloten tests**: track aanmaken (bv. "Stabiel"), de stabiele AAB van de laatste tag uploaden en uitrollen (`docs/google-play.md`, stap 5.4).
- [ ] Deelnamelink van die track in `PLAY_TEST_LINKS.stable` (`src/lib/invite.ts`).
- [ ] 15–20 testers werven (Gmail-adressen in de lijst van de gesloten test) en uitnodigen vanaf Developer op `fluistervink.nl`.
- [x] Contactadres voor de Play Store en de privacypagina: `info@fluistervink.nl` (bestaat sinds 9 nov).
- [ ] Plafond en daglimiet bij OpenAI en Anthropic nalopen: straks kan iedereen zonder code installeren.

Claude (in PR's):

- [ ] **Privacypagina als losse pagina** (`/privacy`), uit dezelfde bron als `#privacy`, zodat Google hem kan lezen zonder JavaScript. Plus wat de Play-regels vragen: wie de app maakt, contact, hoe lang gegevens blijven, je rechten (AVG).
- [x] **Teksten voor de winkelvermelding** in `docs/play-store/README.md`: korte beschrijving (80 tekens), lange beschrijving (tot 4000), categorie. Noem de native functies (trillen met scherm uit, melding tijdens een sessie): Google wijst apps die alleen een website tonen soms af.
- [x] **Antwoorden voor Gegevensveiligheid** (`docs/play-store/README.md`), uit de code afgeleid: audio, precieze locatie, installatie-id, app-activiteit, diagnose (log); verwerkers OpenAI, Anthropic, Cloudflare, Google (Play Integrity); versleuteld onderweg; wissen via feedback.
- [ ] **Tekst voor de verklaring Foreground service** (`FOREGROUND_SERVICE_LOCATION`): waarom, wat de gebruiker ziet. De video (een sessie met de melding, niet-openbaar op YouTube) neemt de eigenaar op.
- [ ] **Schermafbeeldingen** (minstens 2, staand) van de stabiele versie op telefoonformaat, met voorbeeldgegevens.

## 2. Play Console invullen (Dashboard → App instellen)

- [ ] Winkelvermelding: naam "Fluistervink", teksten, pictogram 512×512, feature graphic 1024×500, schermafbeeldingen, contactadres.
- [ ] Privacybeleid: `https://fluistervink.nl/privacy`.
- [ ] Gegevensveiligheid, contentclassificatie (vragenlijst), doelgroep (13+ of 18+, niet kinderen: anders gelden de gezinsregels), advertenties: nee, app-toegang: alles zonder inloggen.
- [ ] Verklaring foreground service, met video.
- [ ] Landen: Nederland en België.

## 3. Logo

Een nieuw pictogram is een native wijziging: nieuwe tag en beide AAB's uploaden. Mag tijdens de gesloten test; laat de start er niet op wachten.

Vragen aan de artiest:

- Vector (SVG), vierkant, **zonder tekst**, herkenbaar op 48 px.
- Twee lagen voor het Android-pictogram: voorgrond en effen achtergrond. Android knipt het rond, vierkant of als druppel bij; het belangrijke deel binnen de middelste ~60%.
- Een effen silhouet in één kleur: meldingsbalk (`ic_stat_vink`) en de gekleurde pictogrammen van Android 13.

Daaruit maken we: Android-pictogram (`android/app/src/main/res/mipmap-*`, adaptief), splash, `public/icon.svg`, `icon-192/512.png`, `apple-touch-icon.png`, Play-pictogram 512 px en de feature graphic.

## 4. Vóór de aanvraag voor productie

- [ ] **Kwaliteitsronde** (`docs/kwaliteitsronde.md`): vóór een nieuwe groep en vóór de productierelease. Na Terschelling, op de beta, dan release naar stable.
- [ ] Feedback van de testers ophalen en verwerken (`npm run feedback -- pull` en `notes`), zodat er iets te vertellen is bij de aanvraag.
- [ ] Laatste release in de gesloten test minstens een paar dagen vóór de aanvraag (beoordeling).

## 5. Productie

- [ ] Productietoegang aanvragen in de Play Console (na 14 dagen, als het dashboard het toestaat).
- [ ] Na goedkeuring: de stabiele AAB naar **Productie**. De beta blijft in de interne test.
- [ ] `#uitleg`, `#privacy` en de uitnodigingsmail nalopen op "test"-taal; `CLAUDE.md` en `NOTES.md` bijwerken.
- [ ] De eerste weken Statistieken en Kosten op Developer volgen.

Later, niet nodig voor de lancering: App Links (`docs/google-play.md`), automatisch uploaden vanuit de workflow.
