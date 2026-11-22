# Draaiboek 2: buiten wandelen

Proeven die buiten moeten: de oortjesmicrofoon vergelijken, het sluiterknopje en opnames voor de testset die nu ontbreken. Op de beta, met oortjes. Vink af wat werkt; schrijf bij een afwijking op wat je zag en spreek het in als feedback. Na afloop alles delen, `npm run feedback -- pull`, en pas dan de testset (per sessie). Een punt dat werkt, gaat uit `NOTES.md`; als alles af is, gaat dit draaiboek naar `docs/archief/`.

Duur: ongeveer een uur. Liefst een rustige plek en een plek met wind of verkeer.

## Voorbereiding

- [ ] Accu van telefoon en oortjes noteren: telefoon …%, oortjes …%.
- [ ] Oortjes gekoppeld, een podcast klaar op de telefoon.
- [ ] Sluiterknopje gekoppeld (als het er is).
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

## A. Oortjesmicrofoon: drie rondes (#267)

Beslist of de telling in de service (`TrektelOpname`) de oortjes gaat gebruiken. Twee oortjesrondes met de telefoon in de hand zijn al gedaan (21 nov, `testset/feedback/oortjesproef/`). Elke ronde een eigen sessie, na de ronde stoppen en delen. Elke zin met de knop in de app (scherm aan), één zin per opname.

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
- [ ] Eén oortje in het doosje: wat doet de telling?
- [ ] Een stukje buiten bereik lopen (als dat kan): de wachtrij vangt het op.
- [ ] Na 15 min stoppen en delen. Accu van de oortjes: …%.
- [ ] Bevindingen inspreken als feedback.

Thuis: testset per sessie (de vier rondes met de twaalf zinnen) en vergelijken. Wint de oortjesmicrofoon duidelijk, dan wordt het native werk (`setPreferredDevice` in `TrektelOpname`).

## B. Sluiterknopje met het scherm uit (#284)

Een Bluetooth-sluiterknopje stuurt volume omhoog en zou dus via de volumeknop moeten werken. Gewone sessie.

- [ ] Scherm aan: knopje indrukken → opname start, nog eens → stopt. "Een koolmees."
- [ ] Scherm uit (op slot): hetzelfde. Tril bij start en einde voelbaar.
- [ ] Met een podcast aan op de telefoon: werkt het nog? Gaat de podcast er niet van harder?
- [ ] Sessie delen. Log: `talk_volume_key`, `screen_off_started` met `via: volume_up`.
- [ ] Bevalt het, dan Maarten aanraden voor op het stuur.

## C. Opnames voor de testset (robuustheid #6, #7; #157)

Gevallen die de testset nog niet heeft. Eén sessie "Testset lastig". Achteraf bij het nalopen het juiste label zetten: wat er had moeten gebeuren, ook als dat "niets" is.

- [ ] **Iemand anders noemt een vogel:** laat een ander tijdens jouw opname zeggen "kijk, een reiger"; jij zegt "een merel". Verwacht: alleen de merel. (Of andersom: alleen de ander praat, jij zegt niets.)
- [ ] **Radio of podcast:** een opname waarin alleen een podcast of radio klinkt, zonder dat jij iets zegt. Verwacht: niets.
- [ ] **Wind:** in de wind een opname van tien seconden zonder iets te zeggen. Verwacht: niets of onzeker. Daarna in dezelfde wind "twee aalscholvers".
- [ ] **Verwijzing ver terug:** na minstens tien andere waarnemingen "die buizerd van een kwartier geleden vloog naar het oosten". Verwacht: de buizerd van toen krijgt overvliegend, er komt geen nieuwe bij.
- [ ] **Latijnse namen:** "Fringilla coelebs", "Buteo buteo", "Erithacus rubecula", "Pica pica". Verwacht: vink, buizerd, roodborst, ekster.
- [ ] **Uit de proef van 20 nov:** "drie houtduiven", dan "nee, het waren duiven". Verwacht: houtduif blijft of wordt een duif, niet Vogel onbekend.
- [ ] **Beginnerswoorden (tuintelling):** "een duif", "twee mussen", "een mees", "een specht". Kijken wat het model ervan maakt; nodig voor `docs/plan-tuintelling.md`.
- [ ] Sessie stoppen en delen, met opnames.

## Afsluiten

- [ ] Accu van telefoon en oortjes noteren: telefoon …%, oortjes …%.
- [ ] Alles gedeeld; thuis `npm run feedback -- pull`, de rondes van deel A door de testset.
- [ ] Bevindingen in `NOTES.md`; werkende punten daar weghalen.
