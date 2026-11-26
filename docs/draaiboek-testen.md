# Draaiboek: alles wat nog op de telefoon moet

Eén lijst met alle proeven die nog openstaan, samengevoegd op 25 nov uit de draaiboeken thuis, buiten en release (die staan nu in `docs/archief/`, met de uitslagen van 22–24 nov), `NOTES.md`, `docs/vrijgave.md`, `docs/plan-robuustheid.md` en de PR's die op de beta nagelopen moeten worden.

Op de beta, met de Android-app, tenzij er iets anders staat. Vink af wat werkt; schrijf bij een afwijking op wat je zag en spreek het in als feedback ("feedback, …"). Na elke ronde de sessie stoppen en delen (met opnames), thuis `npm run feedback -- pull` en `npm run testset`. Een punt dat werkt, gaat hier en uit `NOTES.md` weg; als alles af is, gaat dit draaiboek naar `docs/archief/`.

**Volgorde:** deel 1 aan tafel (een uur), deel 2 op één wandeling of fietsrit (een uur tot anderhalf), deel 3 een lange telling op een vaste plek (twee keer een uur), deel 4 met een kind (begin december), deel 5 met de iPhone (weekend).

## Voorbereiding

- [ ] Accu van telefoon en oortjes noteren bij het begin van deel 2 en 3.

## 1. Thuis aan tafel

Helemaal gedaan op 25 nov; wat werkte is weggehaald. Uitslag van de knop op de oortjes (1.5 en 1.9) in `docs/vrijgave.md`, Knop op de oortjes.

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

**De service:** met "Opnemen met het scherm uit" (`schermUit`) aan neemt bij een **uit of vergrendeld scherm** niet de app op, maar de service van de Android-app (volumeknop, knopje of oortjesknop; ook een hele trektelling). De service gebruikt altijd de **telefoonmicrofoon**: hij kiest de oortjes nog niet (`setPreferredDevice`). Met het scherm aan neemt de app zelf op, met de oortjes als `oortjesMicrofoon` aanstaat; een opname met de knop in de app die al liep, blijft dat ook als het scherm op slot gaat. Met `schermUit` uit neemt de service nooit op, maar stopt een opname als het scherm uitgaat.

Op 24 nov ging het scherm in de zak uit en ging deze ronde via de service, dus met de telefoonmicrofoon (alleen de eerste zin, nog met het scherm aan, ging via "Bluetooth headset"). Nu zonder service, met het scherm aan, zodat alles via de app en de oortjes gaat:

- [ ] `schermUit` **uit**, `oortjesMicrofoon` aan, "Scherm aan houden" aan. Sessie "Mic oortjes zak", telefoon in de borstzak, inspreken met het knopje of de knop in de app.
- [ ] De twaalf zinnen (hieronder), rustig, op normale fluistersterkte. Stoppen en delen.
- [ ] Log: `mic_opened` "Bluetooth headset", `preferHeadset: true`, en **geen** `screen_off_recording`.
- [ ] Thuis door de testset en vergelijken met ronde 1 van 24 nov (12/12). Niet slechter: de oortjesmicrofoon kan mee (`docs/vrijgave.md`). Duidelijk beter: ook in de service (`setPreferredDevice` in `TrektelOpname`, native).

De twaalf zinnen (dezelfde als op 24 nov, zodat de rondes te vergelijken zijn):

1. Zes overvliegende houtduiven
2. Roepje vink
3. Nee, keep in plaats van vink
4. Twee buizerds, vijfhonderd meter zuid
5. Een grote zilverreiger ter plaatse
6. Nog drie erbij
7. Een groepje van twintig kieviten
8. Die laatste weg
9. Een zingende winterkoning
10. Drie kauwen en een zwarte kraai
11. Een man en een vrouw grote bonte specht
12. Vijftien graspiepers overvliegend naar het zuidwesten

**2.4 Wat er van ronde 3 over is (oortjes, niet de koptelefoon)**

- [ ] Tijdens een trektelling met `oortjesMicrofoon` aan één oortje in het doosje: één lange tril, de telling gaat verder met de telefoonmicrofoon.
- [ ] Mobiele data even uit (niet wifi, buiten): lang-kort tril, na een minuut weer aan, alles komt binnen.

**2.5 Opnames voor de testset (robuustheid #6, #7, #19; #157)**

Eén sessie "Testset lastig". Achteraf bij het nalopen het juiste label zetten, ook als dat "niets" is.

- [ ] **Iemand anders noemt een vogel:** een ander zegt "kijk, een reiger", jij zegt "een merel". Verwacht: alleen de merel.
- [ ] **Radio of podcast** zonder dat jij iets zegt. Verwacht: niets.
- [ ] **Wind:** tien seconden niets zeggen in de wind (niets of onzeker), daarna in dezelfde wind "twee aalscholvers".
- [ ] **Verwijzing ver terug:** na minstens tien andere waarnemingen "die buizerd van een kwartier geleden vloog naar het oosten". Verwacht: de buizerd van toen wordt overvliegend, geen nieuwe.
- [ ] **Latijnse namen:** "Fringilla coelebs", "Buteo buteo", "Erithacus rubecula". Verwacht: vink, buizerd, roodborst.
- [ ] **"Drie houtduiven", dan "nee, het waren duiven".** Verwacht: houtduif blijft of wordt een duif, niet Vogel onbekend.
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

- [ ] Ontwikkeloptie **"Scherm uit: webcode laten slapen (accuproef)"** aan (Instellingen → In het veld; webcode, geen nieuwe app-versie). Log: `screen_off_on` met `zichtbaar: false`.
- [ ] Een telling onder dezelfde omstandigheden als 3.1 (even lang, zelfde plek, podcast, oortjes en helderheid, niet aan de lader, ongeveer even vaak iets inspreken; welke vogels maakt niet uit). Verwacht: geen tril na een stuk, alles wordt pas verwerkt als het scherm aangaat. Het verschil in accu met 3.1 is wat de zichtbare WebView kost.
- [ ] Daarna de optie weer uit.

## 4. Met een kind (begin december; #327)

Voor de regel "Leuk met kinderen" op de tuintellingpagina. Liefst een jong en een ouder kind, elk een eigen sessie ("Kind 6 jaar", "Kind 10 jaar").

- [ ] "twee pimpelmeesjes" → 2 Pimpelmezen.
- [ ] "een roodborstje" → Roodborst.
- [ ] "nu vijf koolmezen" → 5 Koolmezen (of een correctie als er al koolmezen waren).
- [ ] Een paar soorten naar eigen keuze. Stoppen en delen, met opnames.
- [ ] Gaat het grotendeels goed, dan blijft de regel staan; anders eruit.

## 5. iPhone (weekend; #360, `docs/plan-ios.md` fase 1)

Een uur aan tafel, daarna een korte wandeling. Nodig: de Mac met Xcode (26.5 staat erop), de iPhone, een kabel die data doet, je Apple-account.

**A. De Mac klaarzetten** (vijf minuten)

- [ ] In de map van het project: `git pull`, `npm ci`, `npm run build` en `npx cap sync ios` (zonder build mist `dist/client`, dat Capacitor als terugval meelevert).
- [ ] `xcode-select -p` moet `/Applications/Xcode.app/Contents/Developer` geven; anders `sudo xcode-select -s /Applications/Xcode.app`.
- [ ] Xcode → Settings → Accounts → + → Apple ID, aanmelden. Een gratis account is genoeg; er verschijnt een "Personal Team".

**B. De iPhone koppelen** (tien minuten, eenmalig)

- [ ] iPhone ontgrendelen en met de kabel aansluiten; op de iPhone "Vertrouw deze computer" en de toegangscode.
- [ ] In Xcode: Window → Devices and Simulators. Wacht tot de iPhone klaar is ("Preparing…" kan even duren).
- [ ] Pas nu staat op de iPhone Instellingen → Privacy en beveiliging → **Ontwikkelaarsmodus** (helemaal onderaan). Aanzetten, de iPhone herstart, daarna "Zet aan" bevestigen.

**C. De app erop zetten**

- [ ] `npx cap open ios`. Links het project App, target App, tab Signing & Capabilities: "Automatically manage signing" aan, Team = je Personal Team. Komt er een rode melding dat `nl.hegmus.fluistervink` niet beschikbaar is: zet het bundle ID tijdelijk op `nl.hegmus.fluistervink.proef` en commit dat niet.
- [ ] Bovenin bij het doel je iPhone kiezen (niet een simulator) en Run ▶. De eerste build duurt een paar minuten.
- [ ] Opent hij niet ("Niet-vertrouwde ontwikkelaar"): op de iPhone Instellingen → Algemeen → VPN en apparaatbeheer → je Apple-account → Vertrouw. Daarna opnieuw Run ▶ of de app op het beginscherm openen.
- [ ] Let op: met een gratis account werkt de app 7 dagen. Daarna opnieuw aansluiten en Run ▶; de gegevens blijven staan.

**D. Aan tafel**

- [ ] Het welkom doorlopen: één vraag voor de microfoon, één voor de locatie, beide in het Nederlands. Daarna "Microfoon: in orde / Locatie: in orde".
- [ ] Instellingen: de versie staat er (bijv. "0.8+… (hash)"), niet leeg.
- [ ] Sessie starten, de kopbalk staat onder het Dynamic Island, de knop boven de thuisbalk. Locatie ±… m.
- [ ] Zet in de instellingen van de iPhone (Geluiden en haptiek) "Systeemhaptiek" aan, anders voel je misschien niets.
- [ ] **Trillen**, telkens telefoon in de hand, zonder te kijken:
  - "een vink" → opgeslagen: één korte tril.
  - "een duif" → onzeker: kort, lang (sinds #414 wordt een kale "duif" onzeker).
  - "hallo, hoe gaat het" → niet begrepen: twee korte.
  - Vliegtuigmodus aan, "een merel" → wacht op bereik: lang, kort. Vliegtuigmodus uit; komt de waarneming binnen?
- [ ] Zijn de vier zonder te kijken uit elkaar te houden? Te zwak, te kort, te lang? Opschrijven per patroon (dat is de uitkomst van fase 1).
- [ ] App wegvegen en weer openen: de sessie loopt door, geen nieuwe vraag om de locatie.

**E. Korte wandeling** (half uur)

- [ ] Een gewone sessie met een paar soorten, ook een correctie ("nee, keep in plaats van vink"). Werkt het zoals in Safari?
- [ ] Voel je de tril in de jaszak of alleen in de hand?
- [ ] Proef voor fase 2 (scherm uit): inspreken, direct het scherm op slot. Komt de tril nog, en staat de waarneming er bij het ontgrendelen? Waarschijnlijk niet; dat is ook een uitkomst.
- [ ] Stoppen en delen, met opnames: het log laat zien wat er op de achtergrond gebeurde (`npm run feedback`).

## Niet in dit draaiboek

- **Telefoon vol** (robuustheid #2, #387): niet zelf testen; merken we als iemand ertegenaan loopt.
- **Wifi met inlogpagina** (#268) en "Geen bereik" dat blijft staan (#260): alleen als het zich voordoet.
- **Insecten** (`--insecten` op echte opnames) en **Engels** (Engelstalige sprekers): later, met eigen opnames.
- **Elke release**: `docs/draaiboek-uitbrengen.md`.
