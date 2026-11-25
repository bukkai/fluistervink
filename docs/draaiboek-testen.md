# Draaiboek: alles wat nog op de telefoon moet

Eén lijst met alle proeven die nog openstaan, samengevoegd op 25 nov uit de draaiboeken thuis, buiten en release (die staan nu in `docs/archief/`, met de uitslagen van 22–24 nov), `NOTES.md`, `docs/vrijgave.md`, `docs/plan-robuustheid.md` en de PR's die op de beta nagelopen moeten worden.

Op de beta, met de Android-app, tenzij er iets anders staat. Vink af wat werkt; schrijf bij een afwijking op wat je zag en spreek het in als feedback ("feedback, …"). Na elke ronde de sessie stoppen en delen (met opnames), thuis `npm run feedback -- pull` en `npm run testset`. Een punt dat werkt, gaat hier en uit `NOTES.md` weg; als alles af is, gaat dit draaiboek naar `docs/archief/`.

**Volgorde:** deel 1 aan tafel (een uur), deel 2 op één wandeling of fietsrit (een uur tot anderhalf), deel 3 een lange telling op een vaste plek (twee keer een uur), deel 4 met een kind (begin december), deel 5 met de iPhone (weekend).

## Voorbereiding

- [ ] Debug-APK `apk/fluistervink-0.7+38-native-opruimen.apk` (#390, native v0.8) op de telefoon zetten. Hij heeft ook de oortjesknop (#372) en de oortjesmicrofoon (#267).
- [ ] XM5: Speak-to-Chat **uit** in de Sony-app (de spookdrukken van 23 nov; zie 1.9).
- [ ] Accu van telefoon en oortjes noteren bij het begin van deel 2 en 3.

## 1. Thuis aan tafel

**1.1 Stop tijdens het inspreken (#366)**

- [ ] Inspreken ("twee merels") en tijdens het praten op Stop. Goed als: de uitspraak staat in de gestopte sessie en is even later verwerkt.

**1.2 Twijfel blijft staan (#388)**

- [ ] "Misschien een grauwe kiekendief" (wordt onzeker), dan "nog één erbij". Goed als: aantal 2 en nog steeds onzeker.

**1.3 Nalopen met dubbele tikken (#389)**

- [ ] Een sessie met drie onzekere waarnemingen, één voor één nalopen en twee keer snel op Klopt tikken. Goed als: alleen de eerste is zeker, de tweede staat er nog.
- [ ] Hetzelfde in de lijst met Weg: de rij die omhoogschuift, blijft staan.
- [ ] Een niet-begrepen uitspraak, twee keer snel op "Maak er een waarneming van": één waarneming.
- [ ] Een sessie op "klaar voor waarneming.nl" zetten, dan voortzetten. Goed als: hij staat niet meer klaar.

**1.4 Opnemen met het scherm uit, snel achter elkaar (#390, debug-APK)**

- [ ] "Opnemen met het scherm uit" aan. Met de volumeknop opnemen, stoppen en meteen opnieuw starten. Goed als: beide opnames komen aan.
- [ ] Een trektelling starten en stoppen vanuit de app: stukken komen aan, geen fout.

**1.5 Knop op de oortjes (#372), met de XM5**

- [ ] `oortjesKnop` **uit**, muziek op het andere apparaat (laptop), sessie starten. Goed als: de muziek blijft spelen; de volumeknop start en stopt met het scherm uit; in het log geen `screen_off_knop_claim`, een mediatoets als `knop_uit`.
- [ ] Gesproken bevestiging aan (nog steeds `oortjesKnop` uit): is hij te horen? Dit beslist of de stem door het claimen van de knop wegviel.
- [ ] `oortjesKnop` **aan**: de knop op de koptelefoon start en stopt een opname, zoals vroeger.
- [ ] Beslissen (`docs/vrijgave.md`): alleen claimen als er niets speelt, of de knop alleen voor wie hem aanzet.

**1.6 Tuintelling (ontwikkeloptie `tuintelling`; #347, #375, #377, #379)**

- [ ] Een korte tuintelling (vijf minuten): "twee merels", later "nu nog maar één merel". Goed als: de kaart zegt Merel 2.
- [ ] Een vogel zonder gedrag is ter plaatse, niet overvliegend (#347).
- [ ] Volumeknop begint, pauzeert en hervat het tellen (#347).
- [ ] Na afloop is de export ingeklapt: "Ook doorgeven aan waarneming.nl of eBird?" (#349).
- [ ] Het welkom in een privévenster (Chrome) met de ontwikkeloptie aan (#377).

**1.7 Developer (#369–#371)**

- [ ] De app met de code openen op elk eigen toestel (dat markeert hem als eigen).
- [ ] Installaties → **Ongebruikte opruimen**; daarna de overgebleven `app-…` van jezelf op "Van mij". Goed als: de lijst werkt meteen bij en de trechter op Statistieken zakt.
- [ ] Kosten: bedragen rechts op één regel, "Meer" als rijen.

**1.8 Stabiele versie (`fluistervink.nl`, wat testers nu hebben)**

- [ ] De stabiele Android-app opent meteen de app (`/app/`), niet de voorpagina; een geïnstalleerde PWA ook (#326).
- [ ] `/privacy` en `/privacy-en` lezen, en `#privacy` in de app: kort bovenaan, details ingeklapt, klopt met wat er gedeeld wordt (#368, #384).
- [ ] Een tuintelling (de knop hoort er buiten het telweekend niet te zijn), een waarneming openen, de regel onder de knop is weg.

**1.9 Spookdrukken van de XM5 (lage prioriteit)**

- [ ] Een avond met Speak-to-Chat uit en "Opnemen met het scherm uit" aan, koptelefoon op. Goed als: de opname gaat niet meer vanzelf aan en uit (log: geen `KEYCODE_MEDIA_PAUSE` als druk). Verdwijnt het, dan een zin in de uitleg.

**1.10 Easter eggs (#350), als je eraan denkt**

- [ ] Na een wespendief "nee, toch een buizerd": de buizerd springt in beeld, eigen tril een seconde na de gewone.
- [ ] "Een appelvink, was een lifer": slingers en de vink met feesthoedje.

## 2. Buiten: een wandeling of fietsrit

Een gewone sessie, ontwikkelopties zoals je ze normaal hebt. De zinnen tussen echte waarnemingen door.

**2.1 Het model sinds de release van 24 nov (#342–#356, was draaiboek release S)**

In deze volgorde:

1. "Twee merels" → 2 Merels.
2. Even later: "een merel" → een **nieuwe** waarneming, niet genegeerd (#342).
3. "Nog een merel" → telt op bij de vorige (aantal 2).
4. "Drie grasmussen", even later "een graszanger" → een nieuwe graszanger; de grasmussen blijven (#346).
5. "Feedback, die merel was eigenlijk een zanglijster" → alleen feedback; de merel blijft (#346).
6. "Een kauw. Die hadden we al." → geen tweede kauw (#356).
7. "Een appelvink, was een lifer" → één appelvink, geen lijster (#351).
8. "Spreeuwen, niet geteld" → aantal "gezien niet geteld".
9. "Roepje vink", dan "nee, keep in plaats van vink" → de vink wordt een keep.
10. "Die laatste weg" → de laatste verdwijnt.

- [ ] Elke uitspraak gaf de verwachte tril, ook met het scherm uit.
- [ ] Geen dubbele of verdwenen waarnemingen na ontgrendelen.

**2.2 Selfie-stick-knopje en de gesproken bevestiging (#361)**

- [ ] Een paar uitspraken met het knopje, gesproken bevestiging aan. Thuis in Developer → log de regels `speak`: `gesproken: true` zonder dat je iets hoorde = geluid onderweg kwijt; `geen oortjes` = de koptelefoon even niet gezien.

**2.3 Oortjesmicrofoon, telefoon in de zak (#267; ronde 2 opnieuw)**

Op 24 nov ging deze ronde via de service, dus met de telefoonmicrofoon. Nu zonder service:

- [ ] `schermUit` **uit**, `oortjesMicrofoon` aan, "Scherm aan houden" aan. Sessie "Mic oortjes zak", telefoon in de borstzak, inspreken met het knopje of de knop in de app.
- [ ] De twaalf zinnen (hieronder). Stoppen en delen.
- [ ] Log: `mic_opened` "Bluetooth headset", `preferHeadset: true`, en **geen** `screen_off_recording`.
- [ ] Thuis door de testset en vergelijken met ronde 1 van 24 nov (12/12). Niet slechter: de oortjesmicrofoon kan mee (`docs/vrijgave.md`). Duidelijk beter: ook in de service (`setPreferredDevice` in `TrektelOpname`, native).

De twaalf zinnen: (1) Zes overvliegende houtduiven (2) Roepje vink (3) Nee, keep in plaats van vink (4) Twee buizerds, vijfhonderd meter zuid (5) Een grote zilverreiger ter plaatse (6) Nog drie erbij (7) Een groepje van twintig kieviten (8) Die laatste weg (9) Een zingende winterkoning (10) Drie kauwen en een zwarte kraai (11) Een man en een vrouw grote bonte specht (12) Vijftien graspiepers overvliegend naar het zuidwesten.

**2.4 Wat er van ronde 3 over is (oortjes, niet de koptelefoon)**

- [ ] Tijdens een trektelling met `oortjesMicrofoon` aan één oortje in het doosje: één lange tril, de telling gaat verder met de telefoonmicrofoon.
- [ ] Mobiele data even uit (niet wifi, buiten): lang-kort tril, na een minuut weer aan, alles komt binnen.

**2.5 Opnames voor de testset (robuustheid #6, #7, #19; #157; tuintelling punt 10)**

Eén sessie "Testset lastig". Achteraf bij het nalopen het juiste label zetten, ook als dat "niets" is.

- [ ] **Iemand anders noemt een vogel:** een ander zegt "kijk, een reiger", jij zegt "een merel". Verwacht: alleen de merel.
- [ ] **Radio of podcast** zonder dat jij iets zegt. Verwacht: niets.
- [ ] **Wind:** tien seconden niets zeggen in de wind (niets of onzeker), daarna in dezelfde wind "twee aalscholvers".
- [ ] **Verwijzing ver terug:** na minstens tien andere waarnemingen "die buizerd van een kwartier geleden vloog naar het oosten". Verwacht: de buizerd van toen wordt overvliegend, geen nieuwe.
- [ ] **Latijnse namen:** "Fringilla coelebs", "Buteo buteo", "Erithacus rubecula". Verwacht: vink, buizerd, roodborst.
- [ ] **"Drie houtduiven", dan "nee, het waren duiven".** Verwacht: houtduif blijft of wordt een duif, niet Vogel onbekend.
- [ ] **Beginnerswoorden:** "een duif", "twee mussen", "een mees", "een kraai", "een specht", en verkleinwoorden ("twee musjes", "een meesje"). Nodig voor de tuintelling.
- [ ] Een paar uit de tweede tabel van "Uitspraken om te proberen" in `docs/plan-robuustheid.md`.

**2.6 Gebeld worden in een gewone opname (robuustheid #12)**

- [ ] Met oortjes in, midden in een opname laten bellen. Goed als: de opname tot dan toe staat erin en de knop hangt niet op "opnemen".

**Thuis afmaken**

- [ ] Sessie stoppen, onzekere één voor één nalopen, "Alles klopt".
- [ ] "Klaar voor waarneming.nl", de CSV maken; hij opent zonder melding in de controlestap van de bulkimport.
- [ ] Delen, `npm run feedback -- pull`, `npm run testset` per sessie. Accu noteren.

## 3. Lange trektelling met het scherm uit

Een vaste plek (vensterbank of vogelhut), `schermUit` aan, `oortjesMicrofoon` uit, niet aan de lader. Af en toe een zin inspreken.

**3.1 Eerste telling, een uur (zoals nu)**

- [ ] Start- en stoptril met het scherm uit, **met een podcast aan** op de telefoon.
- [ ] Na een kwartier een paar keer het scherm aan, de lijst bekijken, weer uit. Goed als: geen gat en geen dubbel stuk rond die momenten.
- [ ] Let op de reden bij onzeker: was die te lang (zoals op 22 nov)?
- [ ] Eindtijd en accu noteren. Log: `trektel_native_end` (`accuBegin`, `accuEind`), `trektel_stuk` met `hidden: false`, geen `page_frozen`.

**3.2 Tweede telling, even lang, zonder zichtbare WebView**

- [ ] Eerst laten maken: een PR die `KEEP_WEBVIEW_VISIBLE` uitzet (`src/lib/screenOff.svelte.ts`, webcode, na de merge meteen in de beta).
- [ ] Dezelfde telling. Het verschil in accu is wat de zichtbare WebView kost. Daarna weer aanzetten (zonder bevriest de webcode en is er geen tril).

## 4. Met een kind (begin december; #327)

Voor de regel "Leuk met kinderen" op de tuintellingpagina. Liefst een jong en een ouder kind, elk een eigen sessie ("Kind 6 jaar", "Kind 10 jaar").

- [ ] "twee pimpelmeesjes" → 2 Pimpelmezen.
- [ ] "een roodborstje" → Roodborst.
- [ ] "nu vijf koolmezen" → 5 Koolmezen (of een correctie als er al koolmezen waren).
- [ ] Een paar soorten naar eigen keuze. Stoppen en delen, met opnames.
- [ ] Gaat het grotendeels goed, dan blijft de regel staan; anders eruit.

## 5. iPhone (weekend; #360, `docs/plan-ios.md` fase 1)

- [ ] De iOS-schil op de eigen iPhone zetten (Xcode, gratis account).
- [ ] Trillen: opgeslagen (kort), onzeker (kort-lang), niet begrepen (twee). Voelbaar en te onderscheiden?
- [ ] Opnemen en GPS zonder tweede vraag, zoals in de simulator.

## Niet in dit draaiboek

- **Telefoon vol** (robuustheid #2, #387): niet zelf testen; merken we als iemand ertegenaan loopt.
- **Wifi met inlogpagina** (#268) en "Geen bereik" dat blijft staan (#260): alleen als het zich voordoet.
- **Insecten** (`--insecten` op echte opnames) en **Engels** (Engelstalige sprekers): later, met eigen opnames.
- **Elke release**: `docs/draaiboek-uitbrengen.md`.
