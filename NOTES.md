# Stand van zaken

Werklog om tussen computers te schakelen: alleen wat nu speelt en wat nog moet. Lees het aan het begin van een sessie en werk het bij aan het eind. Houd het kort: is een onderwerp af, haal het hier weg (de PR's op GitHub vertellen wat er gebeurde; een langere geschiedenis kan naar `docs/archief/werklog-2026.md`).

Waar de rest staat: ontwerp en afspraken in `CLAUDE.md`, de richting in `docs/roadmap.md`, ideeën in `docs/ideeen.md`, sleutels, Android-weetjes en de branch-regel op `main` in `docs/beheer.md`, een overzicht van alle documenten in `docs/README.md`.

## Nu (18 nov)

- **Lancering in Play** (`docs/lancering.md`): gesloten test met 12 testers sinds 17 nov, tot ongeveer 1 dec, daarna productietoegang aanvragen. Testers op stable, de eigenaar op de beta. Plafonds bij OpenAI en Anthropic ingesteld; de proxy begrenst elke installatie per dag (#278: spraak 5 uur, model 1500 verzoeken). Bijstellen met de kosten per gebruiker op Developer (#277). Feedback uit Discord (letterlijk, plus overzicht per tester met wat ermee gedaan is) in `testset/feedback/discord/`, buiten git; feedback in de app is t/m 18 nov verwerkt, van de testers nog bijna niets sinds 17 nov. In de Play Console nagaan: adressen van de interne lijst ook in de gesloten lijst, interne lijst leeg op de eigenaar na (#252, `docs/google-play.md`).
- **Werkwijze tijdens de proef:** nieuwe functies op `main`, liefst achter een ontwikkeloptie; `npm run release` alleen als `main` mee mag, anders een hotfix (`docs/omgevingen.md`). Native code die nog niet mee mag: alleen de beta-AAB uploaden.
- **Release 18 nov:** stable op 3b8e54c (offline wachtrij voor iedereen, robuustheid, plek die later komt, plafonds). Geen nieuwe AAB nodig. Gaat het mis: `stable` terugzetten of de vorige deployment in Cloudflare (geen nieuw Dexie-schema). Kwaliteitsronde gedaan (#279), daarna een architectuurronde: prompt, wachtrij en startscherm in kleinere bestanden, tests met Vitest van 13 naar 5 s (#280–#283, alleen verplaatst, promptversie gelijk; logboek in `docs/kwaliteitsronde.md`). Alles gemerged, gaat met de volgende release mee.
- **Plan komende weken** (ook in `docs/roadmap.md`): (1) proeven op de telefoon (hieronder); (2) tot ~1 dec de aanvraag voorbereiden: feedback en testset, afvinklijst in `docs/lancering.md` (Play Console vermoedelijk grotendeels gedaan); (3) los van de app: het wake word trainen met openWakeWord op de testset; (4) na goedkeuring: AAB naar Productie. Native proeven kunnen al eerder in de beta (#253 zit in v0.4): volgende is de trektelling met het scherm uit, daarna microfoon delen en het wake word als proef die alleen logt.
- **Microfoon van de oortjes** (#267, native, gemerged; stable-AAB zonder plugin toont niets): het sessiescherm zegt met oortjes "Luistert met de telefoon"; ontwikkeloptie "Microfoon van de oortjes" kiest de headset. Debug-APK `apk/fluistervink-0.783-oortjes-microfoon.apk`. Proberen: regel verschijnt, optie aan → toestemming "Apparaten in de buurt", inspreken en trektellen met de telefoon in de zak (log: naam van de oortjes), terugluisteren, podcast aan; daarna de testset voor wat Bluetooth kost. In Play pas met een nieuwe tag.
- **Opnemen met het scherm uit** (#253, v0.4): microfoon in de service alleen in de beta-build (interne test). Verklaring Foreground service aangevuld met microfoon (Background audio input, video) en stabiele v0.4 ingediend voor de gesloten test, 18 nov: wacht op de beoordeling van Google. Afgewezen: een beta zonder microfoon naar de interne test, dan klopt de oude verklaring weer, en de stabiele opnieuw indienen. Nog in het veld: start-/stoptril met het scherm uit, met een podcast aan.
- **Open PR's:** #289 trektelling met het scherm uit (proef, beta, achter `schermUit`; nog niet op de telefoon getest, zie hieronder). Gemerged op 18 nov: #284 knop op de oortjes (werkt half: niet met een podcast aan, bij de XM5 om en om; bewust niet verder), #286 plek "null" negeren, #287 en #288 docs en changelog bij de zeldzame andere dieren.
- **Zeldzame andere dieren** (18 nov, code in 9737137, docs #287): met "Ook andere dieren inspreken" aan zoekt de app wolf, knoflookpad, korenwolf (Europese hamster) e.d. op zoals dwaalgasten, ook in het meervoud en als het model de naam alleen in de twijfelreden zet. Testset: wolf, korenwolven en knoflookpad nu goed; "drie wilde hamsters" niet (door "wilde").
- **Twee sessies tegelijk:** elk in een eigen worktree. Op 18 nov wisselde een sessie in de hoofdmap van branch en nam de niet-gecommitte code van een andere mee in een NOTES-commit op `main`.

## Op de telefoon proberen

Elk punt na het proberen hier weghalen.

- **Trektelling met het scherm uit** (#289, nog niet gemerged): debug-APK `apk/fluistervink-0.906-trektel-scherm-uit.apk` laadt de preview van de branch (eigen opslag: toegangscode opnieuw invullen, ontwikkeloptie "Opnemen met het scherm uit" aan; eerst de Play-versie weg, dus eerst een JSON-export). Trektelling starten (melding: "Trektelling loopt · het scherm mag uit"), dan:
  1. Een kwartier tellen met het scherm uit, af en toe iets inspreken: komen alle stukken door, met plek, en klopt het knippen?
  2. Scherm tussendoor aan en de app openen: lampje en tellers lopen gewoon, geen dubbele stukken, niets weggevallen op de grens.
  3. Gebeld worden: één lange tril (pauze), na het ophangen vanzelf een tril en verder.
  4. Merlin openen en laten luisteren: Fluistervink pauzeert (lange tril), Merlin hoort de vogels; Merlin dicht, Fluistervink gaat vanzelf verder.
  5. Stoppen en sessie delen. In het log: `trektel_stuk` (`screenOffMs`, `transferMs`), `screen_off_trektel_microfoon`, `trektel_native_paused`, `trektel_native_end` met de accu aan begin en eind.

- **Zeldzaam dier inspreken** (na 9737137, beta): "een wolf", "twee knoflookpadden", "drie korenwolven" → die soort, onzeker ("Dwaalgast, niet in de vaste lijst"), niet "Zoogdier onbekend".
- **Sluiterknopje met het scherm uit** (na #284, besteld 18 nov): een Bluetooth-sluiterknopje (één knop, of de iOS-knop) stuurt volume omhoog en zou dus via de volumeknop met het scherm uit moeten werken, ook met een podcast aan. Proberen met het scherm aan, uit, en met een podcast; daarna sessie delen (log: `talk_volume_key`, `screen_off_started` met `via: volume_up`). Bevalt het, dan Maarten aanraden voor op het stuur. Debug-APK `apk/fluistervink-0.886-oortjesknop.apk` (preview van #284) of gewoon de beta.

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

**Uitslag 18 nov** (129 uitspraken van 16–18 nov, prompt c025f8b4, ~$0,08; `testset/resultaten/2026-11-18-20-37_…`): 80% helemaal goed, soorten 92%, correcties 7/7, gedrag 92%. Veel "fouten" zijn verouderde labels: de blauwe reiger ("Uiteraard van de blauwe reiger") en flamingo + kraanvogel komen nu wel binnen, en de trektelstukken van 16 nov (verwerking stopte na "500 m noord") geven nu veel soorten die het label mist. "Goudborstje" wordt roodborst (#264).

- **Zelf beoordelen (#261):** vijf keer kiest het model nu overvliegend in een trektelstuk waar het nagelopen label ter plaatse zegt (houtduif, regenwulp, buizerd, kramsvogel, koperwiek). Zaten ze echt, of niet aangepast bij het nalopen? Zo nodig het label rechtzetten.
- **Echte fouten:** "drieëndertig zilver" → grote zilverreiger (label zilverplevier); "3kj pont" → Pontische meeuw (label zilvermeeuw); "korenwolven" → grauwe gors (opgelost, zie Nu); "grote rotslijster" → grote lijster. Allemaal één keer; geen promptregel.
- **Nog niet gemeten:** iemand anders die een vogel noemt, radio, wind zonder iets te zeggen, "die buizerd van een kwartier geleden" na veel waarnemingen (robuustheid #6, #7); een paar Latijnse namen (#157: het model kan het, de spraakherkenning nog niet gemeten). Hiervoor opnames inspreken.
- **Oortjes na een gesprek** (18 nov): de microfoon ging pas na 0,65 s open en het begin van "vijf overvliegende mussen waarvan twee mannetjes" viel weg; het model hing "van twee mannetjes" aan de kwartels. Wachten op het starttikje helpt; komt het vaker voor, dan nagaan of de oortjesmicrofoon sneller of warm kan.
- **Idee uit feedback** (18 nov): "die houtduiven" zonder eerdere waarneming is waarschijnlijk "drie houtduiven". De testset gaf er 2 (label 1): promptregel alleen als het vaker voorkomt.
- **Opletten:** bereik als schatting ("tussen de vijftig en honderd", #215); preciezere leeftijd ("juveniel, ik denk derde kalenderjaar" wordt nu derde kalenderjaar, het label zegt juveniel; promptregel alleen als het vaker voorkomt).

## Steeds

- Bij elke nieuwe gedeelde sessie `npm run feedback -- pull`, `npm run feedback -- notes` en `npm run testset`.
- Prompt alleen aanpassen als de testset het laat zien: de meeste echte fouten zitten in de spraakherkenning (korte uitspraken, verward met een andere vogelnaam), niet in het model. Vergelijk testset-runs met `--soortgroepen` als die aan stonden.

## Overstappen tussen computers

- Stoppen: `NOTES.md` bijwerken → commit → `git push`.
- Beginnen: `git pull` → `NOTES.md` lezen.
- Geheimen staan niet in git: `.dev.vars` per computer zelf aanmaken (zie README), en `.testers.json` meekopiëren als je testers met het script wilt beheren.
