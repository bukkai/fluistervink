# Draaiboek 2: buiten wandelen

Proeven die buiten moeten: de oortjesmicrofoon vergelijken, opnames voor de testset die nu ontbreken, en een lange trektelling met het scherm uit (C, mag ook thuis bij het raam). Het sluiterknopje (was B) is gedaan op 23 nov: met het scherm uit en een podcast aan kwam elke druk binnen als volume omhoog. Op de beta, met oortjes. Vink af wat werkt; schrijf bij een afwijking op wat je zag en spreek het in als feedback. Na afloop alles delen, `npm run feedback -- pull`, en pas dan de testset (per sessie). Een punt dat werkt, gaat uit `NOTES.md`; als alles af is, gaat dit draaiboek naar `docs/archief/`.

Duur: ongeveer een uur. Liefst een rustige plek en een plek met wind of verkeer.

## Voorbereiding

- [ ] Accu van telefoon en oortjes noteren: telefoon …%, oortjes …%.
- [ ] Oortjes gekoppeld, een podcast klaar op de telefoon.
- [ ] XM5: Speak-to-Chat uit in de Sony-app. Op 23 nov stuurde hij steeds zelf "pauze" (vermoedelijk Speak-to-Chat, nog niet zeker) en dat startte of stopte een opname.
- [ ] Ontwikkeloptie `schermUit` uit, `oortjesMicrofoon` per ronde zoals hieronder.

## De twaalf zinnen

Dezelfde zinnen in elke ronde van deel A, zodat de rondes te vergelijken zijn. Rustig, op normale fluistersterkte.

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

## Uitslag 24 nov

Ronde 1–3 van A (Arnhem, 11:14–11:50, koptelefoon Sony XM5) en C (Velp, 14:27–15:36). Testset op A: 41 van 42 goed; de twee keer "Roepje vink" tellen als fout omdat de bewuste correctie "nee, keep" het label wordt, en "Twee koudjes" werd Vogel onbekend (in de app 2 kauwen, onzeker).

- **Ronde 1** (telefoonmicrofoon, `mic_opened` "Speakerphone", `preferHeadset: false`): de twaalf zinnen 12/12 goed. Gesproken bevestiging stond nog uit (geen `speak` in het log).
- **Ronde 2** (telefoon in de zak, volumeknop): ook 12/12. De opnames liepen via de service (`screen_off_recording`), dus met de **telefoonmicrofoon in de zak**, niet die van de koptelefoon; alleen de eerste uitspraak bij het starten ging via "Bluetooth headset". De oortjesmicrofoon in de zak is dus niet echt geprobeerd, maar de telefoon in de zak verstaat prima.
- **Ronde 3** (trektelling, scherm aan, 17 stukken; accu 72 → 63%, koptelefoon 70 → 63%):
  - Muziek op een ander apparaat stopte zodra de telling begon, en kwam met play niet terug. Vermoeden: het stille geluid waarmee de app de mediaknop claimt (`claimMediaButton`, 300 ms) maakt de telefoon de actieve bron van de koptelefoon (multipoint).
  - Muziek op de telefoon zelf was niet te horen in de koptelefoon.
  - **Gesproken bevestiging niet gehoord**, terwijl het log twintig keer `gesproken: true` zegt. Dat betekent alleen dat de tekst aan de spraak van Android is gegeven (`SprekenPlugin.zeg` meldt niet of hij echt klonk). Eén keer wel gehoord: na het stoppen van de telling, toen de app de microfoon van de koptelefoon opende.
  - Vijf keer `KEYCODE_MEDIA_PAUSE` als druk (`screen_off_druk_trektel`), de eerste 4,5 s na het claimen: de koptelefoon stuurt pauze als de bron wisselt. Ook in C (3,7 s na het claimen).
  - Volumeknop met het scherm aan: alleen volume, geen start of stop.
  - "Eén oortje in het doosje" kon niet (koptelefoon); "buiten bereik lopen" was onduidelijk: bedoeld is zonder mobiel internet.
  - Goed: een uitleg aan een omstander met vogelnamen erin ("ik ben mijn app aan het testen … roodborst … Corvus monedula") werd feedback, geen waarnemingen; "die drie houtduiven aan het begin vlogen naar het westen" paste de houtduiven van 11:30 aan; "Pica pica" werd ekster; feedback midden in een stuk werd apart gezet.
- **C, lang met het scherm uit** (69 min, 57 stukken, alle met `hidden: false`, `bridgeMs` ≤ 72): accu 82 → 71%, ongeveer 10% per uur. Geen gaten. Bellen en Merlin niet gedaan. Een gesprek van anderen aan tafel liep het grootste deel mee: bijna alles genegeerd, maar uit één stuk kwamen vier soorten amfibieën met aantallen uit het gesprek (onzeker), uit een spelletje "noem een vogel" twee kauwen en verder een gewone pad. Zoals bij de podcast in de tuintelling (`docs/plan-tuintelling.md`, punt 9).

## A. Oortjesmicrofoon: drie rondes (#267)

Beslist of de telling in de service (`TrektelOpname`) de oortjes gaat gebruiken. Twee oortjesrondes met de telefoon in de hand zijn al gedaan (21 nov, `testset/feedback/oortjesproef/`), en op 23 nov twee fietsrondes met de oortjesmicrofoon (`NOTES.md`), maar zonder de twaalf zinnen, dus niet te vergelijken. Elke ronde een eigen sessie, na de ronde stoppen en delen. Elke zin met de knop in de app (scherm aan), één zin per opname.

**Ronde 1: telefoonmicrofoon.** Ontwikkeloptie `oortjesMicrofoon` uit, oortjes mogen in.

- [ ] Sessie "Mic telefoon". De regel op het sessiescherm zegt "Luistert met de telefoon".
- [ ] De twaalf zinnen. Stoppen en delen.
- [ ] Log: `mic_opened` met de microfoon van de telefoon, niet "Bluetooth headset".

**Ronde 2: oortjes, telefoon in de zak.** `oortjesMicrofoon` aan.

- [ ] Sessie "Mic oortjes zak". Inspreken met de volumeknop of de oortjesknop, telefoon in de zak, scherm aan of uit maakt niet uit.
- [ ] De twaalf zinnen. Stoppen en delen.
- [ ] Log: `mic_opened` "Bluetooth headset", `preferHeadset: true`.

**Ronde 3: belstand, een kwartier.** Een gewone trektelling met het scherm aan (`schermUit` uit, `oortjesMicrofoon` aan) houdt de oortjesmicrofoon vast zoals de service dat zou doen.

- [ ] Trektelling starten, scherm aan laten.
- [ ] 5 min met muziek of een podcast van een ander apparaat op de oortjes: hapert het, valt het weg?
- [ ] 5 min met een podcast op de telefoon zelf: blijft de telling luisteren?
- [ ] Volumeknop en oortjesknop proberen; gesproken bevestiging aan: is hij te horen?
- [ ] Eén oortje in het doosje (of de koptelefoon even uit): wat doet de telling?
- [ ] Mobiel internet even uit (vliegtuigstand of mobiele data uit): de wachtrij vangt het op.
- [ ] Na 15 min stoppen en delen. Accu van de oortjes: …%.
- [ ] Bevindingen inspreken als feedback.

Thuis: testset per sessie (de vier rondes met de twaalf zinnen) en vergelijken. Wint de oortjesmicrofoon duidelijk, dan wordt het native werk (`setPreferredDevice` in `TrektelOpname`).

## B. Opnames voor de testset (robuustheid #6, #7; #157)

Gevallen die de testset nog niet heeft. Eén sessie "Testset lastig". Achteraf bij het nalopen het juiste label zetten: wat er had moeten gebeuren, ook als dat "niets" is.

- [ ] **Iemand anders noemt een vogel:** laat een ander tijdens jouw opname zeggen "kijk, een reiger"; jij zegt "een merel". Verwacht: alleen de merel. (Of andersom: alleen de ander praat, jij zegt niets.)
- [ ] **Radio of podcast:** een opname waarin alleen een podcast of radio klinkt, zonder dat jij iets zegt. Verwacht: niets.
- [ ] **Wind:** in de wind een opname van tien seconden zonder iets te zeggen. Verwacht: niets of onzeker. Daarna in dezelfde wind "twee aalscholvers".
- [ ] **Verwijzing ver terug:** na minstens tien andere waarnemingen "die buizerd van een kwartier geleden vloog naar het oosten". Verwacht: de buizerd van toen krijgt overvliegend, er komt geen nieuwe bij.
- [ ] **Latijnse namen:** "Fringilla coelebs", "Buteo buteo", "Erithacus rubecula", "Pica pica". Verwacht: vink, buizerd, roodborst, ekster.
- [ ] **Uit de proef van 20 nov:** "drie houtduiven", dan "nee, het waren duiven". Verwacht: houtduif blijft of wordt een duif, niet Vogel onbekend.
- [ ] **Beginnerswoorden (tuintelling):** "een duif", "twee mussen", "een mees", "een specht". Kijken wat het model ervan maakt; nodig voor `docs/plan-tuintelling.md`.
- [ ] Sessie stoppen en delen, met opnames.

## C. Trektelling met het scherm uit, lang (`docs/plan-trektelmodus.md`, punt 4)

Op 22 nov werkte het in drie korte tellingen (stukken meteen verwerkt, met tril). Nog niet geprobeerd: een lange telling voor de accu, gebeld worden, Merlin. Een aparte sessie, één tot twee uur, op een vaste plek; liefst met wat vogels of zelf af en toe een zin inspreken, zodat er stukken met spraak zijn. Daarna beslissen of het na de productierelease naar iedereen gaat (Maarten).

- [ ] Ontwikkeloptie `schermUit` aan, `oortjesMicrofoon` uit (de service neemt op met de telefoon). Telefoon niet aan de lader.
- [ ] Sessie "Trektel scherm uit lang", trektelling starten met de app op het scherm. Begintijd: …, accu …%.
- [ ] Scherm uit, telefoon neerleggen. Na elk stuk met spraak (ongeveer een minuut) voel je de tril van het verwerken.
- [ ] **Scherm aan en uit:** na een kwartier een paar keer het scherm aan, de lijst bekijken, weer uit. Verwacht: geen gat en geen dubbel stuk rond die momenten.
- [ ] **Gebeld worden:** laat iemand bellen (of bel jezelf met een tweede telefoon), een minuut praten, ophangen. Verwacht: lange tril bij het opnemen van de oproep (pauze), de telling gaat na het ophangen vanzelf verder, zonder Fluistervink te openen. Wat je in het gesprek zegt, komt niet in de telling.
- [ ] **Merlin:** Merlin openen, Sound ID een minuut laten luisteren, Merlin sluiten (scherm mag daarna uit). Verwacht: Merlin hoort geluid, Fluistervink pauzeert met een lange tril en gaat daarna vanzelf verder. Langer dan een kwartier pauze stopt de telling; dus niet te lang.
- [ ] Na één tot twee uur stoppen. Eindtijd: …, accu …%. Delen.
- [ ] Bevindingen inspreken als feedback.

Thuis in het log: `trektel_native_end` (`accuBegin`, `accuEind`, `stukken`, `stil`), `trektel_native_paused` en `screen_off_trektel_microfoon` bij het bellen en Merlin, `trektel_stuk` (`hidden: false`, geen grote gaten tussen de stukken), geen `page_frozen` met `frozenMs`. Accu per uur uitrekenen.

**Daarna, een tweede keer:** dezelfde telling, even lang, met `KEEP_WEBVIEW_VISIBLE` uit (`src/lib/screenOff.svelte.ts`; webcode, dus na de merge meteen in de beta, geen nieuwe app-versie). Het verschil in accu is wat de zichtbare WebView kost. Daarna weer aanzetten: zonder bevriest de webcode, en is er geen tril met het scherm uit.

## Afsluiten

- [ ] Accu van telefoon en oortjes noteren: telefoon …%, oortjes …%.
- [ ] Alles gedeeld; thuis `npm run feedback -- pull`, de rondes van deel A door de testset.
- [ ] Bevindingen in `NOTES.md`; werkende punten daar weghalen.
