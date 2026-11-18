# Stand van zaken

Werklog om tussen computers te schakelen: alleen wat nu speelt en wat nog moet. Lees het aan het begin van een sessie en werk het bij aan het eind. Houd het kort: is een onderwerp af, haal het hier weg (de PR's op GitHub vertellen wat er gebeurde; een langere geschiedenis kan naar `docs/archief/werklog-2026.md`).

Waar de rest staat: ontwerp en afspraken in `CLAUDE.md`, de richting in `docs/roadmap.md`, ideeën in `docs/ideeen.md`, sleutels, Android-weetjes en de branch-regel op `main` in `docs/beheer.md`, een overzicht van alle documenten in `docs/README.md`.

## Nu (18 nov)

- **Lancering in Play** (`docs/lancering.md`): gesloten test met 12 testers sinds 17 nov, tot ongeveer 1 dec, daarna productietoegang aanvragen. Testers op stable, de eigenaar op de beta. Plafonds bij OpenAI en Anthropic ingesteld; de proxy begrenst elke installatie per dag (#278: spraak 5 uur, model 1500 verzoeken). Bijstellen met de kosten per gebruiker op Developer (#277). In de Play Console nagaan: adressen van de interne lijst ook in de gesloten lijst, interne lijst leeg op de eigenaar na (#252, `docs/google-play.md`).
- **Werkwijze tijdens de proef:** nieuwe functies op `main`, liefst achter een ontwikkeloptie; `npm run release` alleen als `main` mee mag, anders een hotfix (`docs/omgevingen.md`). Native code die nog niet mee mag: alleen de beta-AAB uploaden.
- **Release 18 nov:** stable op 3b8e54c (offline wachtrij voor iedereen, robuustheid, plek die later komt, plafonds). Geen nieuwe AAB nodig. Gaat het mis: `stable` terugzetten of de vorige deployment in Cloudflare (geen nieuw Dexie-schema). Kwaliteitsronde gedaan (#279), daarna een architectuurronde: prompt, wachtrij en startscherm in kleinere bestanden, tests met Vitest van 13 naar 5 s (#280–#283, alleen verplaatst, promptversie gelijk; logboek in `docs/kwaliteitsronde.md`). Alles gemerged, gaat met de volgende release mee.
- **Plan komende weken** (ook in `docs/roadmap.md`): (1) proeven op de telefoon (hieronder); (2) tot ~1 dec de aanvraag voorbereiden: feedback en testset, afvinklijst in `docs/lancering.md` (Play Console vermoedelijk grotendeels gedaan); (3) los van de app: het wake word trainen met openWakeWord op de testset; (4) na goedkeuring: AAB naar Productie, #253 mergen en taggen, dan microfoon delen en het wake word als proef die alleen logt.
- **Microfoon van de oortjes** (#267, native, gemerged; stable-AAB zonder plugin toont niets): het sessiescherm zegt met oortjes "Luistert met de telefoon"; ontwikkeloptie "Microfoon van de oortjes" kiest de headset. Debug-APK `apk/fluistervink-0.783-oortjes-microfoon.apk`. Proberen: regel verschijnt, optie aan → toestemming "Apparaten in de buurt", inspreken en trektellen met de telefoon in de zak (log: naam van de oortjes), terugluisteren, podcast aan; daarna de testset voor wat Bluetooth kost. In Play pas met een nieuwe tag.
- **Opnemen met het scherm uit** (#253, v0.4): microfoon in de service alleen in de beta-build (interne test). Verklaring Foreground service aangevuld met microfoon (Background audio input, video) en stabiele v0.4 ingediend voor de gesloten test, 18 nov: wacht op de beoordeling van Google. Afgewezen: een beta zonder microfoon naar de interne test, dan klopt de oude verklaring weer, en de stabiele opnieuw indienen. Nog in het veld: start-/stoptril met het scherm uit, met een podcast aan.
- **Open PR's:** #284 knop op de oortjes start en stopt een opname (proef scherm uit, beta; geen nieuwe toestemming; werkt met de XM5 en een podcast aan, podcast speelt door). #286 plek "null" van het model negeren, log bij mislukte proefopname in het welkom.

## Op de telefoon proberen

Elk punt na het proberen hier weghalen.

- **Knop op de oortjes** (#284, `apk/fluistervink-0.878-oortjesknop.apk`): werkt met de XM5 en een podcast aan (18 nov). Nog proberen: oortjes zonder podcast, een nieuwe aflevering midden in de sessie, een sluiterknopje, en na de sessie of de knop de podcast weer pauzeert. Let op de stop-tril: in de zak slecht te voelen (18 nov dacht je dat een stop niet werkte).

- **Robuustheid** (#274, `docs/plan-robuustheid.md`): gebeld worden in een trektelling; oortjes uit tijdens een trektelling; telefoon vol. Als het zich voordoet: wifi met inlogpagina (#268), en of "Geen bereik, … wachten" nog blijft staan na weer verbinding (nu met Probeer opnieuw, #260). Gedaan op 18 nov: offline plek (eerste GPS na 49 s, wachtende uitspraken kregen hun plek alsnog) en gebeld worden midden in een opname (opname netjes bewaard; na het ophangen nog ~1,5 min geen mobiel internet, de wachtrij ving het op).
- **Trektelling: eerst vragen** (#263): naar een ander scherm → "Toch weggaan?"; Annuleren houdt de telling aan, OK stopt hem.
- **Plek in een trektelstuk** (#248): "buizerd, 500 m zuid" in een trektelling: alle soorten van het stuk komen binnen, met de plek.
- **Soortveld** (#233): "noordse" typen: suggesties onder het veld, één tik kiest, Inspreken weg tijdens het typen.
- **Opslaan in beeld** (#237): tijdens een sessie een waarneming openen: Opslaan meteen onderaan, het ronde knopje niet over Annuleren.
- **Opname afspelen** (#222): nog eens tikken pauzeert, een tweede opname stopt de eerste.
- **Instellingen** (#234, #235): "Ook andere dieren inspreken" staat aan en een ree komt goed binnen; volumeknop aan, gesproken bevestiging uit (zelf weer aanzetten); Ontwikkelopties zegt "Op dit moment geen". Play-tekst bijwerken (`docs/play-store/README.md`).
- **Developer en Statistieken** (#244, #245): "Verwerkte wissen" (blijft weg na opnieuw delen), nieuwe indeling bevalt; week in de grafiek aantikken licht de rij op.
- Bij de volgende import naar waarneming.nl een Bonte Kraai meenemen (#153).

## Met de testset nagaan

Na de eerstvolgende gedeelde sessie (`npm run testset`; moet sinds #265 vanzelf eindigen):

- **Prompt veranderd:** trektelling zonder gedrag is overvliegend, "roepje vink" en "zit" blijven, een ree ter plaatse (#261); "groepje merel" zonder aantal is roepend, "groepje van twintig vinken" een groep (#259); opmerking zonder het woord "feedback" wordt niets, met het woord (ook in een trektelstuk) feedback (#242); altijd met kandidaten (#235); "goudborstje" wordt roodborst (#264).
- **Opnames inspreken:** iemand anders die een vogel noemt, radio, wind zonder iets te zeggen, "die buizerd van een kwartier geleden" na veel waarnemingen (robuustheid #6, #7); een paar Latijnse namen (#157: het model kan het, de spraakherkenning nog niet gemeten).
- **Oortjes na een gesprek** (18 nov): de microfoon ging pas na 0,65 s open en het begin van "vijf overvliegende mussen waarvan twee mannetjes" viel weg; het model hing "van twee mannetjes" aan de kwartels. Wachten op het starttikje helpt; komt het vaker voor, dan nagaan of de oortjesmicrofoon sneller of warm kan.
- **Gemist:** "Uiteraard van de blauwe reiger. Twee roepende kwartels. En een appelvink." leverde geen blauwe reiger op (18 nov, met oortjes).
- **Idee uit feedback** (18 nov): "die houtduiven" zonder eerdere waarneming is waarschijnlijk "drie houtduiven". Promptregel alleen als de testset het vaker laat zien.
- **Opletten:** bereik als schatting ("tussen de vijftig en honderd", #215); preciezere leeftijd ("juveniel, ik denk derde kalenderjaar" werd juveniel; promptregel alleen als het vaker voorkomt).

## Steeds

- Bij elke nieuwe gedeelde sessie `npm run feedback -- pull`, `npm run feedback -- notes` en `npm run testset`.
- Prompt alleen aanpassen als de testset het laat zien: de meeste echte fouten zitten in de spraakherkenning (korte uitspraken, verward met een andere vogelnaam), niet in het model. Vergelijk testset-runs met `--soortgroepen` als die aan stonden.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen staan niet in git: `.dev.vars` per computer zelf aanmaken (zie README), en `.testers.json` meekopiëren als je testers met het script wilt beheren.
