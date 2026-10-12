# Mijlpaal MVP (12 okt 2026)

In `CLAUDE.md` staat: *na drie à vier echte wandelingen is het grootste deel van de waarnemingen zonder correctie correct, en werken spraakcorrecties ("nee, keep") betrouwbaar. Pas dan investeren in de native laag.* Dit is die beoordeling.

## Conclusie

**Beide criteria zijn gehaald.**

- Ongeveer **88%** van de ingesproken waarnemingen was zonder correctie goed (37 van 42).
- Correcties met de stem werkten **9 van de 10 keer**. De ene mislukte correctie (Tim, "die kei van net") is sinds PR #75 opgelost.
- Elke fout van het model die we vonden, is inmiddels met een promptwijziging aangepakt.

Wat overblijft, ligt vooral buiten het model: verstaanfouten bij jargon, en opnames die per ongeluk gemaakt zijn.

**Kanttekeningen:** het zijn maar drie wandelingen in het veld, alle drie van de eigenaar, in de omgeving van Arnhem, in oktober (weinig soorten, ±50 waarnemingen). Tim heeft alleen een minuut thuis getest. En de huidige prompt is maar op één wandeling getest.

## De wandelingen

| | Datum | Duur | Uitspraken | Nagelopen? |
|---|---|---|---|---|
| 1. Mariëndaal | 10 okt | 94 min | 55 (20 feedback) | Nee, in de app niet. Fouten met de hand geanalyseerd (`docs/veldtests.md`) |
| 2. Lombok | 11 okt | 35 min | 10 (3 feedback) | Ja, deels |
| 3. Biljoen | 12 okt | 28 min | 12 | Ja, en geëxporteerd |
| (Bus) | 12 okt | 32 min | 6 | Getypt, op één opname na. Telt niet mee voor spraak |

Thuisproeven (11 okt, avond) en Tims proef tellen niet mee voor het percentage, wel voor de correcties.

## Waarnemingen zonder correctie goed

| Wandeling | Goed | Fouten |
|---|---|---|
| Mariëndaal | 23 / 27 | "kpv'tje" → Koperwiek (onzeker); nieuwe buizerd gemist in een zin die ook iets verwijderde; wilde eenden met geslacht in de opmerking in plaats van gesplitst; vermoeden "klinkt als een winterkoning" genegeerd |
| Lombok | 6 / 6 | "Tortelduif" → Turkse Tortel, terecht onzeker |
| Biljoen | 8 / 9 | "Landkop" (glanskop) → Vogel onbekend, onzeker |
| **Totaal** | **37 / 42 (88%)** | |

Ook goed: aantallen, gedrag, methode en kleed klopten bij de juiste soort vrijwel altijd. Jargon werd goed herkend ("grobo", "blako", "tuto", "ekkies", "KBV'tje").

### Fouten naar oorzaak

| Oorzaak | Aantal | Status |
|---|---|---|
| Verstaan (jargon, uitspraak) | 2: kpv, landkop | Beide onzeker gemarkeerd. "KPV = KBV" staat sinds #25 in de prompt |
| Model | 2: gemengde zin, wilde eenden. Plus Tims "kei" | Opgelost in #25 en #75 |
| Beleid veranderd | 1: vermoeden genegeerd | Nu een onzekere waarneming (#51) |
| Per ongeluk opgenomen | 2: Roodhalsfuut (20 s broekzak), waarschijnlijk ook Bosuil (bus, 4 s) | Een lange opname wordt nu onzeker (#76). Een korte zoals de Bosuil nog niet |

De **onzeker-vlag** doet zijn werk bij verstaanfouten: alle drie (kpv, landkop, Tims kei) waren gemarkeerd. Fouten van het model en spookopnames waren dat niet. Bij een spookopname zou het voortaan wel moeten, als hij lang is.

## Correcties met de stem

Werkten: "nee, twee", "nee correctie drie zwarte kraaien", "nog een paartje erbij", "die boomkruiper mag weg", "die laatste is een KBV'tje", "die buizerd een hele tijd terug was een ruigpoot", "die vorige mag je aanpassen naar glanskop", "totaal drie wilde eenden, waarvan twee vrouwtjes" en Tims "die kiekendief mag weg, ik zei die kraai".

Mislukt: Tims "die kei van net vloog richting het westen". Dat werd een nieuwe kiekendief in plaats van een correctie op de kraai. Opgelost in #75.

## Snelheid en betrouwbaarheid

- Van einde opname tot waarneming: mediaan **4–5 s** (Mariëndaal 4,3 s, Biljoen 4,5 s).
- Lombok: mediaan 112 s, doordat er twee exemplaren van de app tegelijk open stonden. Opgelost met het slot op de wachtrij (#72). Sindsdien elke keer direct.
- Niets kwijtgeraakt: niet met vliegtuigmodus, niet bij een herstart en niet toen de accu leeg was.

## Wat dit betekent voor de volgende stap

De criteria zijn gehaald, dus volgens het plan mag de native laag (Capacitor). Uit de wandelingen blijkt wel wat die laag het meest moet oplossen, en dat is niet het wake word:

1. **Trillen als de app op de achtergrond staat of het scherm uit is.** Een PWA kan dat niet. Het was de grootste ergernis van de eerste wandeling.
2. **Opnemen met het scherm uit en de microfoon delen met Merlin.**
3. **Wake word "Fluistervink":** na de eerste wandeling *"knop indrukken bevalt; wake word misschien niet eens nodig"*. Een wake word lost wel de spookopnames op (geen knop meer in je zak), maar brengt eigen valse meldingen mee.

Twee manieren om verder te gaan:

- **A. Nu beginnen met Capacitor**, met trillen en achtergrond als eerste doel. De interpretatie is goed genoeg, en verder vogelen levert gaandeweg meer testdata op.
- **B. Eerst nog één of twee wandelingen met de huidige versie**, het liefst ook een echte wandeling van Tim. Dan is de huidige prompt (en #76) in het veld bevestigd en tellen er waarnemingen van iemand anders mee.

Aanbeveling: **B, kort**. Eén wandeling van Tim en één van jezelf, en daarna aan Capacitor beginnen. Het kost weinig, en de conclusie rust nu nog helemaal op één spreker.

## Opruimen

- De **Bosuil** van de bus (12 okt, 09:51) staat nog als waarneming in die wandeling (niet geëxporteerd). Waarschijnlijk niet gezegd, dus weghalen.
- Wandeling 1 is nooit in de app nagelopen (alles nog concept). Niet erg voor de cijfers hierboven, maar wel voor latere testset-runs.
