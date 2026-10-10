# Ideeën: flow en indeling van de app

Ideeën van de eigenaar (10 okt) voor na de MVP-stappen. Nog niet besloten of gepland; bij het oppakken eerst overleggen en dan een PR per onderdeel.

## Schermen

- **Hoofdscherm:** knop "Start wandeling". Na het starten: de inspreekknop, het invoerveld en de waarnemingen van de lopende wandeling.
- **Menu** (bv. hamburgermenu), met de verwachting dat er meer items bij komen:
  - **Instellingen:** een apart scherm (nu staat het op het hoofdscherm).
  - **Vorige wandelingen:** een apart scherm. Per wandeling zichtbaar of hij al geëxporteerd is. Wandelingen los of in één keer opruimen (verwijderen).

## Flow van een wandeling

1. **Starten.** Meteen bepalen waar je bent en die locatie aan de wandeling meegeven, bv. "Wandeling omgeving Lingezegen" of "Wandeling omgeving Rozendaalse bos".
   - Nog uitzoeken: op welk niveau de locatie gekozen wordt (gebied van waarneming.nl, gemeente, natuurgebied, …) en hoe (automatisch voorstel op basis van GPS, zelf kiezen, aanpassen). Het gebied van waarneming.nl per waarneming bestaat al (PR #18) en is een mogelijk vertrekpunt.
2. **Invoeren.** Zoals nu: inspreken of typen.
3. **Beëindigen → reviewscherm.**
4. **Klaar met reviewen → knop "Exporteren".**

## Reviewscherm

Per waarneming drie keuzes:

- **Invoeren:** vinkje, standaard aan. Uitzetten = overslaan bij de export, maar de waarneming blijft bewaard.
- **Wijzigen:** opent het formulier inline (in de lijst, niet als apart scherm).
- **Verwijderen:** haalt de waarneming helemaal weg. Mogelijk dubbelop met het vinkje; blijkt in de praktijk.

**Eigen notities bij een waarneming,** bv. "nog terugluisteren of de determinatie klopt" of "locatie aanpassen, hij zat verderop in een boom". Bedoeld voor jezelf tijdens het verifiëren; waarschijnlijk niet mee in de export (later beslissen).
- Let op: het bestaande veld "Opmerking" (PR #15) gaat nu wél mee in de export (`Species Comments`, en in de bulkimport van PR #19 als opmerking). Waarschijnlijk twee velden nodig: een opmerking voor waarneming.nl en een eigen notitie. Spraak ("bij thuiskomst terugluisteren") hoort dan in de eigen notitie.

**Kaartje** met alle waarnemingen als stip:

- Waarneming in de lijst aantikken → stip op de kaart gemarkeerd, en andersom (stip aantikken → waarneming in de lijst gemarkeerd).
- Bij wijzigen toont de kaart alleen de stip van die waarneming. Die stip kun je verslepen om de locatie bij te werken.
- Kaartweergave staat in `CLAUDE.md` nog buiten de MVP (nu alleen een link naar de kaart); dit idee is de invulling voor later. Voor de hand liggend: Leaflet met OpenStreetMap.

## Gevolgen voor het datamodel (eerste gedachten)

- Session: locatienaam/gebied, status geëxporteerd (en wanneer).
- Observation: vlag "niet exporteren", eigen notitie naast de opmerking, aangepaste locatie (met markering dat hij handmatig is verplaatst, zodat de oorspronkelijke GPS-positie bewaard blijft voor de testset).
